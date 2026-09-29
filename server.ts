import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json());

// Barbearia details
const BARBER_SHOP = {
  name: "Gentleman's Club (Gentlemen's Cut)",
  phone: "912 429 615",
  address: "16 R. Duarte Pacheco Pereira",
  instagram: "@gentlemenscut.pt",
  calLink: "jose-lopes-r6m7oq",
  bookingUrl: "https://cal.com/jose-lopes-r6m7oq"
};

const SYSTEM_INSTRUCTION = `És o anfitrião e consultor de imagem oficial da barbearia "${BARBER_SHOP.name}". 
O teu papel é receber cada cliente com simpatia, elegância e autoridade profissional, oferecendo uma experiência moderna, personalizada e acolhedora de barbearia tradicional e contemporânea.

PERSONALIDADE E TOM DE VOZ:
- Tom: Amigável, cortês, confiante, moderno e descontraído (o espírito de um verdadeiro "gentleman").
- Estilo de comunicação: Conversas fluidas e naturais. Estás livre para usar emojis (✂️, 💈, 🧔, ✨, 📅, 📍, 👌) com bom gosto e formatação em **negrito** ou listas para destacar pontos importantes.
- Idioma: Responde com naturalidade no idioma em que o cliente te abordar (Português de Portugal por defeito).

MISSÕES PRINCIPAIS:
1. Autonomia e Consultoria de Estilo:
   - Tens total liberdade para dar conselhos especializados sobre cortes masculinos (Skin Fade, Taper, Low/Mid/High Fade, Textured Crop, Pompadour, Buzz Cut, Side Part, Mullet contemporâneo, etc.).
   - Podes orientar o cliente consoante o seu formato de rosto (redondo, oval, quadrado, etc.) e tipo de cabelo (liso, ondulado, crespo, fino ou espesso).
   - Dá dicas práticas de cuidados com a barba (hidratação com óleos, bálsamos modeladores, contorno com toalha quente e navalha) e produtos de styling (pomadas efeito mate sem brilho, ceras de fixação forte, pós de volume).

2. Domínio Fluido das Informações da Barbearia:
   - Em vez de recitar listas rígidas, integra os dados da barbearia de forma orgânica na conversa:
     * Corte de Cabelo Clássico: 15€ (inclui sempre lavagem com champô adequado, secagem e finalização com produto profissional).
     * Arranjo de Barba: 10€ (com toalha quente, navalha e hidratação com óleo/bálsamo).
     * Pacote Completo (Corte + Barba): 22€ (a nossa combinação de assinatura mais procurada).
     * Corte Infantil: 12€ (a partir dos 4 anos de idade).
     * Coloração / Madeixas / Descoloração: entre 25€ e 45€ (avaliado presencialmente no salão).
     * Venda de Produtos: Temos disponíveis pomadas, óleos de barba e champôs profissionais da nossa própria bancada.
     * Horário de Funcionamento: Segunda a Sexta das 09:00 às 20:00; Sábados das 09:00 às 14:00. Encerrados aos Domingos e feriados.
     * Localização: ${BARBER_SHOP.address} (estacionamento na rua com parquímetro e parque gratuito a 5 min a pé).
     * Contacto direto: Telefone ${BARBER_SHOP.phone} e Instagram ${BARBER_SHOP.instagram}.
     * Agendamento Oficial Online: ${BARBER_SHOP.bookingUrl} (integrado no site via Cal.com).
     * Pagamentos: Numerário, Multibanco, Visa, Mastercard e MB Way.
     * Tolerância de atraso: 10 minutos. Cancelamentos pedidos com pelo menos 12h de antecedência.

3. Condução Orgânica para Agendamento (CTA):
   - Conduz a conversa de forma suave e persuasiva para que o cliente marque o seu serviço no site ou por telefone.
   - Explica que pode agendar diretamente no nosso calendário online (secção de agendamento aqui na página ou através do link ${BARBER_SHOP.bookingUrl}) ou ligar para o ${BARBER_SHOP.phone}.
   - Menciona que aceitamos clientes sem marcação (walk-ins) se houver vaga no momento, mas o agendamento garante a cadeira e o barbeiro sem qualquer espera.

4. Gestão de Temas Fora de Contexto:
   - Se o cliente tentar falar sobre assuntos totalmente alheios à barbearia (política partidária, religião, rivalidades futebolísticas extremas, código de programação, medicina, etc.), recusa educadamente e com classe, usando bom humor de barbearia:
     Exemplo: "Aqui na Gentleman's Club a nossa arte é navalha afiada, cortes no ponto e barba alinhada! 💈 Esses assuntos deixo para o café da esquina. Mas diz-me: como posso ajudar a dar aquele upgrade ao teu visual hoje?"
   - Nunca sejas frio ou robótico. Mantém sempre o foco no bem-estar, na imagem e na comodidade do cliente.`;

// Fallback rule matcher if external AI API is unreachable
function getLocalFallbackAnswer(question: string): string {
  const q = question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Preços e Serviços
  if (q.includes("preco") || q.includes("valor") || q.includes("quanto") || q.includes("custa") || q.includes("tabela") || q.includes("servico")) {
    if (q.includes("corte") && !q.includes("barba") && !q.includes("completo") && !q.includes("pacote")) {
      return "O corte de cabelo tem o valor de 15€ e inclui lavagem com champô adequado, secagem e finalização.";
    }
    if (q.includes("barba") && !q.includes("corte")) {
      return "O arranjo de barba tem o valor de 10€.";
    }
    if (q.includes("crianca") || q.includes("infantil") || q.includes("filho") || q.includes("miudo")) {
      return "Fazemos cortes infantis a partir dos 4 anos de idade pelo valor de 12€.";
    }
    if (q.includes("pintura") || q.includes("descolora") || q.includes("madeixa") || /\bcor\b|\bcores\b/.test(q)) {
      return "Os trabalhos de coloração (descolorações, madeixas ou pinturas) variam entre 25€ e 45€, sendo avaliados no salão.";
    }
    return "O corte de cabelo é 15€, o arranjo de barba 10€ e o pacote completo (Corte + Barba) fica por 22€.";
  }

  // Crianças isolado
  if (q.includes("crianca") || q.includes("infantil") || q.includes("filho") || q.includes("miudo") || q.includes("bebe")) {
    return "Sim, fazemos cortes a crianças a partir dos 4 anos de idade. O valor é de 12€.";
  }

  // Horários
  if (q.includes("horario") || q.includes("aberto") || q.includes("fecha") || q.includes("hora") || q.includes("abrem") || q.includes("fecham") || q.includes("sabado") || q.includes("domingo")) {
    return "Estamos abertos de Segunda a Sexta das 09:00 às 20:00, e aos Sábados das 09:00 às 14:00. Encerramos aos Domingos e feriados.";
  }

  // Localização e Estacionamento
  if (q.includes("onde") || q.includes("morada") || q.includes("localiza") || q.includes("fica") || q.includes("rua") || q.includes("estacionamento") || q.includes("parque") || q.includes("carro") || q.includes("parquear")) {
    return `Estamos situados no número 16 da Rua Duarte Pacheco Pereira. Existem lugares de estacionamento na rua (com parquímetro) e um parque gratuito a cerca de 5 minutos a pé.`;
  }

  // Agendamento / Marcação / Cancelamento
  if (q.includes("marca") || q.includes("agend") || q.includes("reserva") || q.includes("cancelar") || q.includes("desmarcar") || q.includes("ordem de chegada") || q.includes("walk in")) {
    if (q.includes("cancel") || q.includes("desmarc") || q.includes("reagend")) {
      return "Pedimos que qualquer cancelamento ou reagendamento seja comunicado com pelo menos 12 horas de antecedência.";
    }
    return `Recomendamos marcação prévia através da nossa secção de agendamento online (cal.com/jose-lopes-r6m7oq) ou pelo telefone ${BARBER_SHOP.phone} para garantir vaga. Também atendemos sem marcação se houver vaga no momento.`;
  }

  // Atrasos e tolerância
  if (q.includes("atraso") || q.includes("tolerancia") || q.includes("atrasar")) {
    return "Dispomos de uma tolerância máxima de 10 minutos para atrasos no agendamento.";
  }

  // Lavagem de cabelo
  if (q.includes("lavagem") || q.includes("lava") || (q.includes("cabelo") && q.includes("inclui"))) {
    return "Sim, todos os cortes incluem lavagem com champô adequado, secagem e finalização com produto profissional.";
  }

  // Pagamentos
  if (q.includes("pagamento") || q.includes("mbway") || q.includes("mb way") || q.includes("multibanco") || q.includes("cartao") || q.includes("dinheiro")) {
    return "Aceitamos numerário, cartão Multibanco, Visa, Mastercard e MB Way.";
  }

  // Produtos
  if (q.includes("produto") || q.includes("venda") || q.includes("pomada") || q.includes("oleo") || q.includes("cera") || q.includes("shampoo") || q.includes("champo")) {
    return "Sim, temos disponíveis para venda as mesmas pomadas, óleos de barba e champôs que utilizamos no salão.";
  }

  // Dicas de estilo e cortes no fallback
  if (q.includes("estilo") || q.includes("fade") || q.includes("degrade") || q.includes("corte") || q.includes("rosto") || q.includes("tendencia") || q.includes("moderno")) {
    return "Se procuras um visual moderno e limpo, os cortes com **Fade (degradê)** — seja *Low Fade* mais discreto ou *Mid Fade* marcante — combinam muito bem com quase todos os formatos de rosto! ✂️💈\n\nPara o topo, um efeito texturizado (*crop*) ou clássico com pomada mate dá o toque perfeito de gentleman. Que tal marcarmos um horário no nosso calendário online para fazermos essa transformação?";
  }

  // Cuidados com a barba no fallback
  if (q.includes("barba") || q.includes("oleo") || q.includes("balsamo") || q.includes("falha") || q.includes("crescer")) {
    return "Para manter a barba saudável e impecável, o segredo é **hidratação diária com óleo específico** para nutrir a pele e os fios, além de alinhar os contornos na navalha! 🧔✨\n\nNo nosso serviço de barba (10€), aplicamos toalha quente relaxante e finalização com bálsamo. Queres reservar uma sessão connosco?";
  }

  // Filtro de temas fora de contexto no fallback
  if (q.includes("politica") || q.includes("governo") || q.includes("eleic") || q.includes("futebol") || q.includes("clube") || q.includes("religiao") || q.includes("codigo") || q.includes("programar") || q.includes("bitcoin") || q.includes("crypto")) {
    return "Aqui na Gentleman's Club a nossa arte é navalha afiada, cortes no ponto e barba alinhada! 💈✂️ Esses assuntos deixamos para o café da esquina. Mas diz-me: como posso ajudar a dar aquele upgrade ao teu visual hoje?";
  }

  return `Na Gentleman's Club estamos prontos para cuidar do teu estilo! 💈✂️ Podes agendar a tua vaga no nosso calendário online aqui no site, ligar diretamente para **${BARBER_SHOP.phone}** ou visitar-nos na **${BARBER_SHOP.address}**. Em que serviço estás mais interessado hoje?`;
}

// Lazy Gemini client initializer
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!geminiClient && apiKey) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    barberShop: BARBER_SHOP,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY,
  });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Mensagem obrigatória" });
    }

    const trimmedMessage = message.trim();

    // Prepare contents
    const contents: any[] = [];

    if (Array.isArray(history) && history.length > 0) {
      // Keep last 6 history items for context
      const recent = history.slice(-6);
      for (const h of recent) {
        if (h.role === "user" || h.role === "model") {
          contents.push({
            role: h.role,
            parts: [{ text: h.text || h.content || "" }],
          });
        }
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: trimmedMessage }],
    });

    const ai = getGeminiClient();

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.65, // Balanço perfeito entre criatividade em consultoria de estilo e precisão factual
          },
        });

        const replyText = response.text?.trim();
        if (replyText) {
          return res.json({ reply: replyText });
        }
      } catch (err: any) {
        console.warn("Gemini API call returned error, falling back to strict FAQ matcher:", err?.message || err);
      }
    }

    // High fidelity fallback based on the exact same FAQ rules
    const fallbackAnswer = getLocalFallbackAnswer(trimmedMessage);
    return res.json({ reply: fallbackAnswer });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return res.json({
      reply: `Infelizmente não consigo ajudar com essa questão por aqui. Para informações mais específicas, por favor contacte o salão diretamente através do telefone ${BARBER_SHOP.phone} ou visite-nos na ${BARBER_SHOP.address}.`
    });
  }
});

async function start() {
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
    console.log(`Gentlemen's Cut Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
