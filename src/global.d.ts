/// <reference types="@solidjs/start/env" />

interface TsGrammar {
  folder: string;
  highlighter: import("shiki").BundledLanguage | "text";
}

type ClientMessage =
  | {
      type: "add";
      folder: string;
    }
  | {
      type: "watch";
      folders: string[];
    }
  | {
      type: "tsCliCheck";
    }
  | {
      type: "tsCliDownload";
      version: string;
    }
  | {
      type: "tsWasmCheck";
    }
  | {
      type: "tsWasmDownload";
      version: string;
    }
  | {
      type: "tsDownload";
      version: string;
    }
  | {
      type: "emsdkCheck";
    }
  | {
      type: "emsdkDownload";
    };

type TsCliStatus = "unset" | "downloading" | "downloaded" | "error";
type TsWasmStatus = "unset" | "downloading" | "downloaded" | "error";
type EmsdkStatus = "unset" | "downloading" | "setuped" | "error";

type ServerMessage =
  | {
      type: "load";
      grammar: string;
    }
  | {
      type: "generateError";
      grammar: string;
      error: string;
    }
  | {
      type: "wasmError";
      grammar: string;
      error: string;
    }
  | {
      type: "tsCliStatus";
      status: TsCliStatus;
    }
  | {
      type: "tsWasmStatus";
      status: TsWasmStatus;
    }
  | {
      type: "tsDownloaded";
      version: string;
    }
  | {
      type: "emsdkStatus";
      status: EmsdkStatus;
    };
