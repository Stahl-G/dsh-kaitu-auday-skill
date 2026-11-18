var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name2, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name: name2, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name2, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name2]() {
    return __privateGet(this, extra);
  }, set [name2](x) {
    return __privateSet(this, extra, x);
  } }, name2));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name2) : __name(target, name2);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name2, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name2 in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name2];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name2] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name2, desc), p ? k ^ 4 ? extra : desc : target;
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// adapters/dsh/service.ts
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { homedir } from "node:os";
import { join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

// adapters/dsh/runner.mjs
import { existsSync, linkSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, join } from "node:path";
var AudayRunner = class {
  constructor(subprocess, root, home, python = "python3") {
    Object.assign(this, { subprocess, root, home, python });
    this.children = /* @__PURE__ */ new Set();
    this.controllers = /* @__PURE__ */ new Set();
  }
  async close() {
    for (const controller of this.controllers) controller.abort();
    const children = [...this.children];
    for (const child of children) child.terminate();
    await Promise.all(children.map((child) => child.waitForExit()));
  }
  async run(operation, input = {}) {
    let args;
    switch (operation) {
      case "doctor":
      case "status":
      case "sync":
      case "discover":
        args = [operation];
        break;
      case "pair":
        if (typeof input.service !== "string" || !input.service.trim()) throw new Error("device_required");
        args = ["pair-dialog", "--service", input.service];
        break;
      case "search":
        if (!Number.isInteger(input.offset ?? 0) || (input.offset ?? 0) < 0) throw new Error("invalid_page");
        args = ["search", "--limit", "20", "--offset", String(input.offset ?? 0)];
        break;
      case "preview":
        args = ["handoff"];
        break;
      default:
        throw new Error("unknown_operation");
    }
    const controller = new AbortController();
    this.controllers.add(controller);
    const execute = async (argv, stdin = "ignore") => {
      controller.signal.throwIfAborted();
      const child = this.subprocess.spawn({
        argv,
        cwd: this.root,
        graceMs: 1e3,
        signal: controller.signal,
        env: { AUDAY_PROGRESS: "0" },
        stdio: { stdin, stdout: { maxBytes: 16 * 1024 * 1024 }, stderr: { maxBytes: 4096 } }
      });
      this.children.add(child);
      try {
        const outcome = await child.done;
        controller.signal.throwIfAborted();
        return { ...outcome, output: child.collected.stdout.readFrom(0) };
      } finally {
        child.terminate();
        await child.waitForExit();
        this.children.delete(child);
      }
    };
    const parse = ({ exitCode, output }) => {
      if (exitCode !== 0) {
        const known = [
          "not_paired",
          "password_input_cancelled",
          "use_generated_16_character_communication_password",
          "authentication_or_connection_failed",
          "awaiting_phone_or_wrong_password",
          "keychain_save_failed"
        ];
        for (const line of output.text.split("\n")) {
          let error;
          try {
            error = JSON.parse(line).error;
          } catch {
            continue;
          }
          const code = typeof error === "string" ? error.split(":")[0] : "";
          if (code === "swift_missing") throw new Error("swift_toolchain_unavailable");
          if (known.includes(code)) throw new Error(code);
        }
        throw new Error("operation_failed");
      }
      if (output.lossy) throw new Error("selection_too_large");
      return JSON.parse(output.text);
    };
    try {
      let python;
      try {
        python = await this.subprocess.resolveExecutable(this.python, void 0, controller.signal);
      } catch (error) {
        controller.signal.throwIfAborted();
        throw new Error("python_unavailable");
      }
      if (process.platform === "darwin" && python === "/usr/bin/python3") {
        if ((await execute(["/usr/bin/xcode-select", "-p"])).exitCode !== 0)
          throw new Error("apple_command_line_tools_missing");
      }
      const command = (...args2) => [python, join(this.root, "scripts/auday.py"), "--home", this.home, ...args2];
      return parse(await execute(command(...args), operation === "preview" ? { data: JSON.stringify(input.ids) } : "ignore"));
    } finally {
      this.controllers.delete(controller);
    }
  }
};
function submitNotes(workspace, notes) {
  if (!isAbsolute(workspace) || !existsSync(join(workspace, ".kaitu/config.json")))
    throw new Error("workspace_missing");
  const directory = join(workspace, "inbox/agents");
  mkdirSync(directory, { recursive: true });
  for (const note of notes) {
    if (!/^auday-[a-f0-9]{64}-[a-f0-9]{64}\.md$/.test(note.name) || typeof note.text !== "string")
      throw new Error("invalid_handoff");
    const path = join(directory, note.name);
    const temporary = join(directory, `.auday-${randomUUID()}.tmp`);
    writeFileSync(temporary, note.text, { flag: "wx", mode: 384 });
    try {
      linkSync(temporary, path);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    } finally {
      unlinkSync(temporary);
    }
  }
  return { submitted: notes.length };
}

// adapters/dsh/service.ts
var name = "kaitu-auday";
var inject = ["subprocess"];
var _request_dec, _a, _init;
var AudayService = class extends (_a = TypertRemoteService, _request_dec = [Remote("request")], _a) {
  constructor(ctx, runner, workspace) {
    super(ctx, "kaituAuday");
    this.runner = runner;
    this.workspace = workspace;
    __runInitializers(_init, 5, this);
  }
  runner;
  workspace;
  async request(operation, input) {
    const args = JSON.parse(input);
    if (operation === "cancel") {
      await this.runner.close();
      return "{}";
    }
    if (process.platform !== "darwin") throw new Error("macOS_required");
    if (operation === "import") {
      const preview = await this.runner.run("preview", args);
      if (JSON.stringify(preview.notes.map((note) => note.name)) !== JSON.stringify(args.names))
        throw new Error("source_changed");
      return JSON.stringify(submitNotes(this.workspace, preview.notes));
    }
    return JSON.stringify(await this.runner.run(operation, args));
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "request", _request_dec, AudayService);
__decoratorMetadata(_init, AudayService);
function apply(ctx, config = {}) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const runner = new AudayRunner(
    ctx.get("subprocess"),
    root,
    join2(process.env.DSH_HOME || join2(homedir(), ".dsh"), "auday"),
    config.python
  );
  new AudayService(ctx, runner, config.workspace || process.env.KAITU_DIR || "");
  ctx.effect(() => () => runner.close());
}
export {
  AudayService,
  apply,
  inject,
  name
};
