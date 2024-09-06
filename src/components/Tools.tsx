import {
  AiFillCheckCircle,
  AiFillCloseCircle,
  AiFillQuestionCircle,
} from "solid-icons/ai";
import { IoArrowDownCircle } from "solid-icons/io";
import {
  Component,
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  onMount,
  untrack,
  useContext,
} from "solid-js";
import { Motion } from "solid-motionone";

import { AppContext } from "~/components/TreeGround";

import { sendMsgToServer } from "~/utils";

const Tools: Component = () => {
  const ctx = useContext(AppContext);
  const [tsVersions, setTsVersions] = createSignal<string[]>([]);
  const [tsInputVersion, setTsInputVersion] = createSignal<string>(
    localStorage.getItem("treeground.tsVersion") || "",
  );
  const [tsSetupedVersion, setTsSetupedVersion] = createSignal<string>(
    localStorage.getItem("treeground.tsVersion") || "",
  );
  const [tsCliStatus, setTsCliStatus] = createSignal<TsCliStatus>("unset");
  const [tsWasmStatus, setTsWasmStatus] = createSignal<TsWasmStatus>("unset");
  const tsDownloading = () =>
    tsCliStatus() === "downloading" || tsWasmStatus() === "downloading";
  const [emsdkStatus, setEmsdkStatus] = createSignal<EmsdkStatus>("unset");

  const tgReady = () =>
    tsCliStatus() == "downloaded" &&
    tsWasmStatus() == "downloaded" &&
    emsdkStatus() === "setuped";

  onMount(() => {
    fetch("https://api.github.com/repos/tree-sitter/tree-sitter/tags")
      .then((res) => res.json())
      .then((data) => {
        setTsInputVersion(data[0].name);
        setTsVersions(data.map((tag: any) => tag.name));
      });
  });

  createEffect(() => {
    localStorage.setItem("treeground.tsVersion", tsSetupedVersion());
  });

  createEffect(() => {
    const socket = ctx.ws();
    if (socket) {
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === "tsCliStatus") {
          setTsCliStatus(message.status);
        } else if (message.type === "tsWasmStatus") {
          setTsWasmStatus(message.status);
        } else if (message.type === "emsdkStatus") {
          setEmsdkStatus(message.status);
          if (message.status === "unset" || message.status === "error") {
            sendMsgToServer(socket, { type: "emsdkDownload" });
          }
        }
      });
      socket.addEventListener("open", () => {
        sendMsgToServer(socket, { type: "tsCliCheck" });
        sendMsgToServer(socket, { type: "tsWasmCheck" });
        sendMsgToServer(socket, { type: "emsdkCheck" });
      });
    }
  });

  createEffect(() => {
    if (tsCliStatus() == "downloaded" && tsWasmStatus() === "downloaded") {
      setTsSetupedVersion(untrack(() => tsInputVersion()));
    }
  });

  const handleTsVersionSubmit = (e: Event) => {
    e.preventDefault();
    const socket = ctx.ws();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const version = tsInputVersion();
      if (version) {
        sendMsgToServer(socket, {
          type: "tsCliDownload",
          version,
        });
        sendMsgToServer(socket, {
          type: "tsWasmDownload",
          version,
        });
      }
    }
  };

  return (
    <Show when={!tgReady() || ctx.modal() === "Tools"}>
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg">
          <div
            class="px-3 py-2 border-b border-gray-300 flex justify-end"
            classList={{ hidden: !tgReady() }}
          >
            <AiFillCloseCircle
              size={28}
              class="text-gray-500 hover:text-blue-500 active:scale-110 transition-all cursor-pointer"
              onclick={() => ctx.setModal(null)}
            />
          </div>
          <div class="p-3">
            <div class="mt-2 mb-3">
              <form
                class="flex justify-center"
                onsubmit={handleTsVersionSubmit}
              >
                <select
                  class="p-2 w-[200px] border border-gray-300 rounded-s disabled:bg-gray-200 disabled:text-gray-500"
                  value={tsInputVersion()}
                  onChange={(e) => setTsInputVersion(e.target.value)}
                  disabled={tsDownloading()}
                >
                  <For each={tsVersions()}>
                    {(version) => <option value={version}>{version}</option>}
                  </For>
                </select>
                <button
                  type="submit"
                  class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded-e disabled:bg-blue-300"
                  disabled={tsDownloading()}
                  title="Download"
                >
                  <IoArrowDownCircle size={20} />
                </button>
              </form>
            </div>
            <div class="flex gap-1 align-middle my-2">
              <div>
                <Switch>
                  <Match when={tsCliStatus() === "unset"}>
                    <AiFillQuestionCircle size={26} class="text-gray-500" />
                  </Match>
                  <Match when={tsCliStatus() === "downloading"}>
                    <StatusDownloading />
                  </Match>
                  <Match when={tsCliStatus() === "downloaded"}>
                    <AiFillCheckCircle size={26} class="text-green-500" />
                  </Match>
                  <Match when={tsCliStatus() === "error"}>
                    <AiFillCloseCircle size={26} class="text-red-500" />
                  </Match>
                </Switch>
              </div>
              <span class="font-bold">Treesitter CLI</span>
            </div>
            <div class="flex gap-1 align-middle my-2">
              <div>
                <Switch>
                  <Match when={tsWasmStatus() === "unset"}>
                    <AiFillQuestionCircle size={26} class="text-gray-500" />
                  </Match>
                  <Match when={tsWasmStatus() === "downloading"}>
                    <StatusDownloading />
                  </Match>
                  <Match when={tsWasmStatus() === "downloaded"}>
                    <AiFillCheckCircle size={26} class="text-green-500" />
                  </Match>
                  <Match when={tsWasmStatus() === "error"}>
                    <AiFillCloseCircle size={26} class="text-red-500" />
                  </Match>
                </Switch>
              </div>
              <span class="font-bold">Treesitter WASM</span>
            </div>
            <hr />
            <div class="flex gap-1 align-middle my-2">
              <div>
                <Switch>
                  <Match when={emsdkStatus() === "unset"}>
                    <AiFillQuestionCircle size={26} class="text-gray-500" />
                  </Match>
                  <Match when={emsdkStatus() === "downloading"}>
                    <StatusDownloading />
                  </Match>
                  <Match when={emsdkStatus() === "setuped"}>
                    <AiFillCheckCircle size={26} class="text-green-500" />
                  </Match>
                  <Match when={emsdkStatus() === "error"}>
                    <AiFillCloseCircle size={26} class="text-red-500" />
                  </Match>
                </Switch>
              </div>
              <span class="font-bold">Emscripten SDK</span>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default Tools;

const StatusDownloading: Component = () => {
  return (
    <Motion
      animate={{ scale: [1, 1.1, 1] }}
      transition={{
        duration: 1,
        repeat: Infinity,
        easing: "linear",
      }}
    >
      <IoArrowDownCircle
        size={26}
        class="text-yellow-500"
        title="Downloading"
      />
    </Motion>
  );
};
