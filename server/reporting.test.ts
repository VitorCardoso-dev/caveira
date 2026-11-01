import { describe, expect, it } from "vitest";
import { getReportWindows } from "./reporting";

describe("janelas dos relatórios", () => {
  it("usa o dia informado pelo usuário e separa mês, hoje e últimos 14 dias", () => {
    const result = getReportWindows("2026-11-01");
    expect(result.month).toBe("2026-11");
    expect(result.monthStart).toBe("2026-11-01");
    expect(result.monthDays).toBe(1);
    expect(result.monthToDateDays).toEqual(["2026-11-01"]);
    expect(result.dailyDays).toHaveLength(14);
    expect(result.dailyDays[0]).toBe("2026-10-19");
    expect(result.dailyDays.at(-1)).toBe("2026-11-01");
  });

  it("trata fevereiro bissexto e a virada do mês", () => {
    const result = getReportWindows("2024-03-01");
    expect(result.monthToDateDays).toEqual(["2024-03-01"]);
    expect(result.dailyDays[0]).toBe("2024-02-17");
  });

  it("rejeita datas impossíveis", () => {
    expect(() => getReportWindows("2026-02-30")).toThrow("Data de referência inválida");
  });
});
