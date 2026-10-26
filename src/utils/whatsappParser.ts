import { ExtractedItem } from "../types";

export function parseTransactionsHeuristic(text: string): ExtractedItem[] {
  const lines = text.split(/\r?\n|;/);
  const items: ExtractedItem[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Search for currency amount
    const matchVal = line.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)/i);
    if (!matchVal) continue;

    const raw = matchVal[1];
    let amount = 0;
    if (raw.includes(",") && raw.includes(".")) {
      amount = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    } else if (raw.includes(",")) {
      amount = parseFloat(raw.replace(",", "."));
    } else {
      amount = parseFloat(raw);
    }
    if (isNaN(amount) || amount <= 0) continue;

    const lower = line.toLowerCase();
    let type: "receita" | "gasto_fixo" | "cartao" | "investimento" | "imprevisto" = "cartao";
    let card: string | null = "BB";
    let category = "Geral";

    let desc = line
      .replace(matchVal[0], "")
      .replace(/\b(no|na|em|de|para|com|pelo|pela|via|pix)\b/gi, " ")
      .replace(/[:\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!desc || desc.length < 2) {
      desc = "Despesa";
    }

    if (
      lower.includes("salario") ||
      lower.includes("salário") ||
      lower.includes("recebi") ||
      lower.includes("freela") ||
      lower.includes("pix recebido") ||
      lower.includes("pro labore") ||
      lower.includes("rendimento") ||
      lower.includes("dividendo") ||
      lower.includes("entrada")
    ) {
      type = "receita";
      card = null;
      category = "Receitas";
    } else if (
      lower.includes("aluguel") ||
      lower.includes("condominio") ||
      lower.includes("condomínio") ||
      lower.includes("luz") ||
      lower.includes("energia") ||
      lower.includes("agua") ||
      lower.includes("água") ||
      lower.includes("internet") ||
      lower.includes("plano de saude") ||
      lower.includes("plano de saúde") ||
      lower.includes("academia") ||
      lower.includes("mensalidade") ||
      lower.includes("iptu") ||
      lower.includes("ipva")
    ) {
      type = "gasto_fixo";
      card = null;
      category = "Moradia / Contas Fixas";
    } else if (
      lower.includes("aporte") ||
      lower.includes("investim") ||
      lower.includes("acoes") ||
      lower.includes("ações") ||
      lower.includes("fii") ||
      lower.includes("tesouro") ||
      lower.includes("cdb") ||
      lower.includes("cripto") ||
      lower.includes("btc") ||
      lower.includes("etf")
    ) {
      type = "investimento";
      card = null;
      category = "Investimentos";
    } else if (
      lower.includes("imprevisto") ||
      lower.includes("emergencia") ||
      lower.includes("emergência") ||
      lower.includes("urgencia") ||
      lower.includes("urgência") ||
      lower.includes("remedio") ||
      lower.includes("remédio") ||
      lower.includes("farmacia") ||
      lower.includes("farmácia") ||
      lower.includes("mecanico") ||
      lower.includes("mecânico") ||
      lower.includes("conserto") ||
      lower.includes("guincho") ||
      lower.includes("dentista")
    ) {
      type = "imprevisto";
      card = null;
      category = "Saúde / Emergências";
    } else {
      type = "cartao";
      if (lower.includes("c6")) {
        card = "C6";
      } else if (lower.includes("amazon")) {
        card = "Amazon";
      } else if (lower.includes("nubank") || lower.includes("nu")) {
        card = "Nubank";
      } else {
        card = "BB";
      }

      if (lower.includes("mercado") || lower.includes("supermercado") || lower.includes("feira") || lower.includes("padaria")) {
        category = "Alimentação";
      } else if (lower.includes("restaurante") || lower.includes("lanche") || lower.includes("ifood") || lower.includes("jantar") || lower.includes("almoco") || lower.includes("almoço")) {
        category = "Refeição Fora";
      } else if (lower.includes("uber") || lower.includes("gasolina") || lower.includes("combustivel") || lower.includes("combustível") || lower.includes("estacionamento")) {
        category = "Transporte";
      } else if (lower.includes("livro") || lower.includes("fone") || lower.includes("eletronico") || lower.includes("compras")) {
        category = "Compras & Lazer";
      }
    }

    items.push({
      id: "item_" + Math.random().toString(36).substring(2, 9),
      type,
      description: desc.charAt(0).toUpperCase() + desc.slice(1),
      amount,
      card,
      category,
      date: today,
      status: type === "gasto_fixo" ? "pendente" : "pago",
      selected: true,
    });
  }

  return items;
}
