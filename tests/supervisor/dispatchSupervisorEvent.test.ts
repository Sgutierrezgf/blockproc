import { dispatchSupervisorEvent } from "../../blockproc/src/supervisor/dispatchSupervisorEvent";
import type { Supervisor } from "../../blockproc/src/supervisor/supervisor";

function createFakeSupervisor(): { supervisor: Supervisor; calls: string[] } {
  const calls: string[] = [];
  const supervisor: Supervisor = {
    onForegroundChanged: (packageName) => calls.push(`onForegroundChanged:${packageName}`),
    onTick: () => calls.push("onTick"),
    onScreenOn: () => calls.push("onScreenOn"),
    onScreenOff: () => calls.push("onScreenOff"),
  };
  return { supervisor, calls };
}

// RF-27 (T51): traduce la carga de datos de la tarea Headless JS (un objeto
// plano, tal como llega desde el Bundle de Android) a la llamada del
// supervisor que corresponde. Sin nada nativo de por medio, para poder
// probarlo con un supervisor falso.
describe("dispatchSupervisorEvent", () => {
  it("ForegroundChanged llama a onForegroundChanged con el paquete", () => {
    const { supervisor, calls } = createFakeSupervisor();
    dispatchSupervisorEvent(supervisor, { event: "ForegroundChanged", packageName: "com.instagram.android" });
    expect(calls).toEqual(["onForegroundChanged:com.instagram.android"]);
  });

  it("ForegroundChanged sin packageName llama con null", () => {
    const { supervisor, calls } = createFakeSupervisor();
    dispatchSupervisorEvent(supervisor, { event: "ForegroundChanged" });
    expect(calls).toEqual(["onForegroundChanged:null"]);
  });

  it("Tick, ScreenOn y ScreenOff llaman a su método correspondiente", () => {
    const { supervisor, calls } = createFakeSupervisor();
    dispatchSupervisorEvent(supervisor, { event: "Tick" });
    dispatchSupervisorEvent(supervisor, { event: "ScreenOn" });
    dispatchSupervisorEvent(supervisor, { event: "ScreenOff" });
    expect(calls).toEqual(["onTick", "onScreenOn", "onScreenOff"]);
  });
});
