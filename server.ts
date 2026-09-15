import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initialization of Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
    timestamp: new Date().toISOString(),
  });
});

// Heuristic rule-based extractor for instant fallback or when no API key is provided
function parseTransactionsHeuristic(text: string) {
  const lines = text.split(/\r?\n|;/);
  const items = [];
  const today = new Date().toISOString().split("T")[0];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Search for currency amount
    // Matches formats like: 1500, 1.500,00, 250,50, R$ 380, 49.90
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

    // Clean description by removing currency/numbers and connecting words
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
      id: "heur_" + Math.random().toString(36).substring(2, 9),
      type,
      description: desc.charAt(0).toUpperCase() + desc.slice(1),
      amount,
      card,
      category,
      date: today,
      status: type === "gasto_fixo" ? "pendente" : "pago",
    });
  }

  return items;
}

// POST /api/ai/extract-whatsapp
app.post("/api/ai/extract-whatsapp", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Texto das mensagens é obrigatório." });
      return;
    }

    const ai = getGeminiClient();

    if (!ai) {
      // Graceful smart fallback using local heuristic parser
      const parsed = parseTransactionsHeuristic(text);
      res.json({
        success: true,
        items: parsed,
        usedAi: false,
        note: "Processado via motor local inteligente (Chave Gemini não configurada).",
      });
      return;
    }

    const prompt = `Você é um assistente financeiro especialista em extrair lançamentos financeiros de mensagens de WhatsApp, extratos e notificações bancárias em português do Brasil.

Analise o seguinte texto enviado pelo usuário:
"""
${text}
"""

Extraia cada transação financeira identificada. Mapeie para uma destas categorias ("type"):
- "receita": Entradas de dinheiro, salário, freelance, pro-labore, pix recebido, reembolsos, vendas.
- "gasto_fixo": Contas mensais essenciais e recorrentes como aluguel, condomínio, luz/energia, internet, água, plano de saúde, mensalidade.
- "cartao": Compras cotidianas no cartão de crédito como supermercado, restaurantes, lanches, compras online, uber, combustível.
- "investimento": Aportes para o futuro como Tesouro Direto, CDB, FIIs, Ações, Cripto, Reserva de Emergência.
- "imprevisto": Despesas emergenciais súbitas como remédio de urgência, conserto do carro/mecânico, vazamento, consulta inesperada.

Para transações do tipo "cartao", identifique o cartão mencionado ("BB", "C6", "Amazon", "Nubank" ou outro). Se não especificar, use "BB".
Data: use YYYY-MM-DD (se não houver data explícita, use a data de hoje).
Valor: número decimal positivo (ex: 250.00).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "Retorne exclusivamente um JSON válido com o array de transações estruturadas.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Tipo: receita, gasto_fixo, cartao, investimento ou imprevisto",
              },
              description: {
                type: Type.STRING,
                description: "Descrição limpa e clara do item",
              },
              amount: {
                type: Type.NUMBER,
                description: "Valor numérico em reais (BRL)",
              },
              card: {
                type: Type.STRING,
                description: "Nome do cartão caso seja cartão, ex: BB, C6, Amazon, Nubank, ou vazio",
              },
              category: {
                type: Type.STRING,
                description: "Categoria detalhada: Alimentação, Moradia, Transporte, Lazer, Saúde, etc.",
              },
              date: {
                type: Type.STRING,
                description: "Data no formato YYYY-MM-DD",
              },
            },
            required: ["type", "description", "amount"],
          },
        },
      },
    });

    const outputText = response.text ? response.text.trim() : "";
    let items = [];
    try {
      items = JSON.parse(outputText);
    } catch {
      // Fallback in case of parse discrepancy
      items = parseTransactionsHeuristic(text);
    }

    const today = new Date().toISOString().split("T")[0];
    const formattedItems = (items || []).map((item: any, index: number) => ({
      id: "ai_" + Date.now() + "_" + index,
      type: ["receita", "gasto_fixo", "cartao", "investimento", "imprevisto"].includes(item.type) ? item.type : "cartao",
      description: item.description || "Lançamento WhatsApp",
      amount: typeof item.amount === "number" ? Math.abs(item.amount) : 0,
      card: item.type === "cartao" ? (item.card || "BB") : null,
      category: item.category || (item.type === "receita" ? "Receitas" : "Geral"),
      date: item.date && item.date.length === 10 ? item.date : today,
      status: item.type === "gasto_fixo" ? "pendente" : "pago",
    }));

    res.json({
      success: true,
      items: formattedItems,
      usedAi: true,
    });
  } catch (error: any) {
    console.error("Erro na extração Gemini, utilizando fallback heurístico:", error?.message);
    const parsed = parseTransactionsHeuristic(req.body?.text || "");
    res.json({
      success: true,
      items: parsed,
      usedAi: false,
      note: "Extraído via mecanismo alternativo.",
    });
  }
});

// POST /api/ai/financial-advisor
app.post("/api/ai/financial-advisor", async (req, res) => {
  try {
    const summary = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      // Rule-based diagnostic if AI key not present
      const savingsRate = summary.totalReceita > 0 ? ((summary.totalInvestimentosMes / summary.totalReceita) * 100).toFixed(1) : "0";
      const fixedRatio = summary.totalReceita > 0 ? ((summary.totalFixos / summary.totalReceita) * 100).toFixed(1) : "0";
      const cardRatio = summary.totalReceita > 0 ? ((summary.totalCartoes / summary.totalReceita) * 100).toFixed(1) : "0";

      let score = 75;
      if (parseFloat(fixedRatio) > 55) score -= 15;
      if (parseFloat(savingsRate) >= 20) score += 15;
      if (parseFloat(cardRatio) > 40) score -= 10;
      if (summary.totalImprevistos > 500) score -= 5;
      score = Math.max(10, Math.min(100, score));

      res.json({
        success: true,
        usedAi: false,
        score,
        healthRating: score >= 80 ? "Excelente" : score >= 60 ? "Saudável" : "Requer Atenção",
        diagnostico: `Suas despesas fixas representam ${fixedRatio}% da sua renda e você está investindo ${savingsRate}% do que ganha neste mês. Seu saldo líquido está ${summary.saldoMensal >= 0 ? "positivo" : "negativo"}.`,
        recomendacoes: [
          `Mantenha os custos fixos abaixo de 50% para aumentar sua flexibilidade financeira.`,
          `Revise os parcelamentos nos cartões (total de R$ ${summary.totalCartoes.toFixed(2)}) para evitar juros e comprometimento de renda futura.`,
          `Priorize fortalecer a reserva de emergência antes de ativos de maior risco se o total investido for menor que 6 meses de gastos fixos.`,
        ],
      });
      return;
    }

    const prompt = `Você é um planejador financeiro CFP® renomado.
Analise os seguintes dados financeiros do usuário no mês atual (em Reais R$):
- Receita Total: R$ ${summary.totalReceita}
- Gastos Fixos: R$ ${summary.totalFixos}
- Gastos com Cartões: R$ ${summary.totalCartoes} (BB: R$ ${summary.totalBB}, C6: R$ ${summary.totalC6}, Amazon: R$ ${summary.totalAmazon})
- Gastos Imprevistos: R$ ${summary.totalImprevistos}
- Aportes em Investimentos no mês: R$ ${summary.totalInvestimentosMes}
- Patrimônio Acumulado Total: R$ ${summary.patrimonioLiquido}
- Meta de Riqueza: R$ ${summary.metaRiqueza}

Forneça uma avaliação em JSON com:
- "score": número inteiro de 0 a 100 que resume a saúde financeira.
- "healthRating": "Excelente", "Saudável", "Moderado" ou "Atenção".
- "diagnostico": resumo conciso (2 a 3 frases) da situação atual, elogiando pontos fortes e apontando gargalos.
- "recomendacoes": lista de 3 recomendações financeiras práticas, estratégicas e ultra-personalizadas para os dados acima.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            healthRating: { type: Type.STRING },
            diagnostico: { type: Type.STRING },
            recomendacoes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["score", "healthRating", "diagnostico", "recomendacoes"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      usedAi: true,
      ...parsed,
    });
  } catch (err: any) {
    console.error("Erro no advisor AI:", err?.message);
    res.status(500).json({ error: "Falha ao gerar diagnóstico com IA." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FinIq Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
