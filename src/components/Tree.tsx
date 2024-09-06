import * as monaco from "monaco-editor-core";
import {
  Accessor,
  Component,
  For,
  Setter,
  Show,
  batch,
  createEffect,
  createSignal,
  onMount,
} from "solid-js";
import type Parser from "web-tree-sitter";
import { SyntaxNode } from "web-tree-sitter";

type ShowItem = { index: number; id: number }[];
type ShowItems = ShowItem[];

const Tree: Component<{
  tree: Accessor<Parser.Tree | null>;
  setErrors: Setter<number>;
  position: Accessor<monaco.Position | null>;
  selection: Accessor<monaco.Selection | null>;
  moveEditorToNode: (node: Parser.SyntaxNode) => void;
}> = (props) => {
  let container: HTMLDivElement = null!;
  const [errorNodes, setErrorNodes] = createSignal<SyntaxNode[]>([]);
  const [selectedErrorNode, setSelectedErrorNode] =
    createSignal<SyntaxNode | null>(null);
  const [highlight, setHighlight] = createSignal<SyntaxNode | null>(null);

  const [scrollTop, setScrollTop] = createSignal(0);
  const [spaceTop, setSpaceTop] = createSignal(0);
  const [spaceBottom, setSpaceBottom] = createSignal(0);
  const [showItems, setShowItems] = createSignal<ShowItems>([]);
  const [collapsedNodes, setCollapsedNodes] = createSignal<{
    [key: number]: boolean;
  }>({});

  onMount(() => {
    container.addEventListener("scroll", () => {
      if (Math.abs(container.scrollTop - scrollTop()) >= 48) {
        const sTop = container.scrollTop;
        const remainder = sTop % 24;
        if (remainder <= 12) {
          setScrollTop(sTop - remainder);
        } else {
          setScrollTop(sTop - remainder + 24);
        }
      }
    });
    window.addEventListener("keydown", (e) => {
      let selected = selectedErrorNode();
      if (e.altKey && e.key === "j") {
        if (selected) {
          let index = errorNodes().findIndex((err) => err.id == selected.id);
          if (index < errorNodes().length - 1) {
            setSelectedErrorNode(errorNodes()[index + 1]);
          } else {
            setSelectedErrorNode(errorNodes()[0]);
          }
        } else {
          setSelectedErrorNode(errorNodes()[0]);
        }
      } else if (e.altKey && e.key === "k") {
        if (selected) {
          let index = errorNodes().findIndex((err) => err.id == selected.id);
          if (index > 0) {
            setSelectedErrorNode(errorNodes()[index - 1]);
          } else {
            setSelectedErrorNode(errorNodes()[errorNodes().length - 1]);
          }
        } else {
          setSelectedErrorNode(errorNodes()[errorNodes().length - 1]);
        }
      }
    });
  });

  createEffect(() => {
    let tree = props.tree();
    if (tree) {
      props.setErrors(0);
      setSelectedErrorNode(null);
      setCollapsedNodes({});
    }
  });

  createEffect(() => {
    let selected = selectedErrorNode();
    if (selected) {
      props.moveEditorToNode(selected);
      setTimeout(() => {
        setHighlight(selected);
      }, 50);
    }
  });

  createEffect(() => {
    let tree = props.tree();
    let position = props.position();
    if (tree && position) {
      let node = tree.rootNode.descendantForPosition({
        row: position.lineNumber - 1,
        column: position.column - 2,
      });
      if (node) {
        setHighlight(node);
      }
    }
  });

  createEffect(() => {
    const tree = props.tree();
    const hlight = highlight();
    if (tree && hlight) {
      let pos = 0;
      function findPosition(node: SyntaxNode) {
        if (node.id === hlight?.id) {
          return true;
        }
        pos += 24;
        for (let children of node.namedChildren) {
          if (children.isNamed) {
            let p = findPosition(children);
            if (p) {
              return true;
            }
          }
        }
      }
      findPosition(tree.rootNode);
      if (
        !(
          container.scrollTop <= pos &&
          pos + 24 <= container.scrollTop + container.clientHeight
        )
      ) {
        container.scrollTo(0, pos - container.clientHeight / 2);
      }
    }
  });

  createEffect(() => {
    let tree = props.tree();
    let cllpsdNodes = collapsedNodes();
    if (tree) {
      batch(() => {
        let errs = 0;
        let errNodes: SyntaxNode[] = [];
        let pos = 0;
        let newShowItems: ShowItems = [];
        const extra = 24 * 10;
        let sTop = scrollTop();
        let pTop = 0;
        let pBottom = 0;
        let loc: ShowItem = [];
        function traverse(
          node: SyntaxNode,
          callapesed: boolean,
          index: number,
        ) {
          loc.push({ index: index, id: node.id });

          if (node.type === "ERROR") {
            errs++;
            errNodes.push(node);
          }
          if (!callapesed) {
            if (pos <= sTop - extra) {
              pTop += 24;
            } else if (pos <= sTop + container.clientHeight + extra) {
              newShowItems.push([...loc]);
            } else {
              pBottom += 24;
            }
            pos += 24;
          }
          for (let i = 0; i < node.children.length; i++) {
            const children = node.children[i];
            if (children.isNamed) {
              traverse(children, callapesed || cllpsdNodes[node.id], i);
            }
          }

          loc.pop();
        }
        traverse(tree.rootNode, false, 0);

        setSpaceTop(pTop);
        setSpaceBottom(pBottom);
        setShowItems(newShowItems);
        props.setErrors(errs);
        setErrorNodes(errNodes);
      });
    }
  });

  return (
    <div
      class="h-full border border-gray-400 p-1 overflow-scroll"
      ref={container}
    >
      <Show when={props.tree()}>
        {(tree) => (
          <>
            <div style={{ height: `${spaceTop()}px` }}></div>
            <Node
              node={tree().rootNode}
              field={null}
              indent={""}
              depth={0}
              index={0}
              showItems={showItems}
              collapsedNodes={collapsedNodes}
              setCollapsedNodes={setCollapsedNodes}
              highlight={highlight}
              setHighlight={setHighlight}
              moveEditorToNode={props.moveEditorToNode}
            />
            <div style={{ height: `${spaceBottom()}px` }}></div>
          </>
        )}
      </Show>
    </div>
  );
};

export default Tree;

const Node: Component<{
  node: Parser.SyntaxNode;
  field: string | null;
  indent: string;
  depth: number;
  index: number;
  showItems: Accessor<ShowItems>;
  collapsedNodes: Accessor<{ [key: number]: boolean }>;
  setCollapsedNodes: Setter<{ [key: number]: boolean }>;
  highlight: Accessor<SyntaxNode | null>;
  setHighlight: Setter<SyntaxNode | null>;
  moveEditorToNode: (node: Parser.SyntaxNode) => void;
}> = (props) => {
  let ref: HTMLDivElement = null!;

  return (
    <>
      <Show
        when={props
          .showItems()
          .find(
            (loc) =>
              loc.length === props.depth + 1 &&
              loc.at(-1)?.index === props.index &&
              loc.at(-1)?.id === props.node.id,
          )}
      >
        <div class="flex h-[24px]" ref={ref}>
          <button
            class="px-1 h-[24px] w-[16px] rounded-sm hover:bg-gray-300"
            classList={{ invisible: !props.node.namedChildren.length }}
            onClick={() =>
              props.setCollapsedNodes((prev) => ({
                ...prev,
                [props.node.id]: !prev[props.node.id],
              }))
            }
          >
            {props.collapsedNodes()[props.node.id] ? "+" : "-"}
          </button>
          <pre class="text-sm pt-[2px] ps-1">
            {props.indent}
            {props.field && <span class="text-gray-500">{props.field}: </span>}
            <span
              class="cursor-pointer text-blue-500 hover:underline"
              classList={{
                "text-red-600": props.node.type === "ERROR",
                "text-blue-950 underline":
                  props.highlight()?.id === props.node.id,
              }}
              onClick={() => {
                props.moveEditorToNode(props.node);
                props.setHighlight(props.node);
              }}
            >
              {props.node.type}
            </span>{" "}
            [{props.node.startPosition.row},{props.node.startPosition.column}
            ]-[
            {props.node.endPosition.row},{props.node.endPosition.column}]
          </pre>
        </div>
      </Show>
      <For each={props.node.children}>
        {(children, index) => (
          <Show
            when={
              children.isNamed &&
              props
                .showItems()
                .find(
                  (loc) =>
                    loc[props.depth + 1]?.index === index() &&
                    loc[props.depth + 1]?.id === children.id,
                )
            }
          >
            <Node
              node={children}
              field={props.node.fieldNameForChild(index())}
              indent={props.indent + "  "}
              depth={props.depth + 1}
              index={index()}
              showItems={props.showItems}
              collapsedNodes={props.collapsedNodes}
              setCollapsedNodes={props.setCollapsedNodes}
              highlight={props.highlight}
              setHighlight={props.setHighlight}
              moveEditorToNode={props.moveEditorToNode}
            />
          </Show>
        )}
      </For>
    </>
  );
};
