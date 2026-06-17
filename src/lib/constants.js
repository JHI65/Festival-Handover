export const SEED = [{
  id: "ejemplo_fest", name: "FESTIVAL EJEMPLO",
  stages: [
    {
      id: "stage1", name: "ESCENARIO PRINCIPAL",
      days: [
        {
          id: "day1", label: "DÍA 1", artists: [
            { id: "s1", artist: "ARTISTA A", console: "SSL 9000", connection: "OPTO DUO 1/2 (point-point)", signal: "AES 1/2", preset: "ARTISTA A", presetOk: true, toLx: "SMPT 1 (naranja)", toMon: "", tecnico: "Local", comments: ["Mesa compartida con artista siguiente", "Señal de video directo desde FOH"], extraSlots: [{ id: "e1", label: "RF", value: "Shure ULXD4Q · CH 38-40" }] },
            { id: "s2", artist: "ARTISTA B", console: "DiGiCo SD10", connection: "MADI 1-4 Festival Box", signal: "MADI", preset: "INITIAL", presetOk: false, toLx: "TIMECODE", toMon: "CH16 → MON WORLD", tecnico: "Banda", comments: [], extraSlots: [] },
            { id: "s3", artist: "ARTISTA C", console: "Avid S6L", connection: "HMA 1/2 (ALL DAY)", signal: "AES 3/4", preset: "INITIAL", presetOk: false, toLx: "", toMon: "", tecnico: "", comments: [], extraSlots: [] },
          ]
        },
        {
          id: "day2", label: "DÍA 2", artists: [
            { id: "s4", artist: "ARTISTA D", console: "Yamaha PM5", connection: "RJ 1/2 SP (Festival Box)", signal: "AES 1/2", preset: "ARTISTA D", presetOk: true, toLx: "SMPT 1 & 2", toMon: "", tecnico: "Local", comments: ["Comparte GAIN con monitor"], extraSlots: [] },
            { id: "s5", artist: "ARTISTA E", console: "DiGiCo SD7", connection: "OPTO DUO (anillo)", signal: "AES 3/4", preset: "INITIAL", presetOk: false, toLx: "", toMon: "", tecnico: "", comments: [], extraSlots: [{ id: "e2", label: "IEM", value: "Sennheiser 2000 · CH 28" }] },
          ]
        },
      ]
    },
  ],
}];

export const OFFLINE_KEY = "foh_offline_v2";

export const PALETTE = ["#C94A2A", "#2A6B6B", "#D4A843", "#7B5EA7", "#1E6B8C", "#B85C38", "#3D7A5C", "#8C4A6B"];
