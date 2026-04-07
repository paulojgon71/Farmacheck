import { useState, useRef } from "react";
import "./App.css";

const SEV = {
  grave:    { cls:"sev-grave",    badge:"bg-grave",    icon:"⛔", label:"Grave" },
  moderada: { cls:"sev-moderada", badge:"bg-moderada", icon:"⚠️", label:"Moderada" },
  ligeira:  { cls:"sev-ligeira",  badge:"bg-ligeira",  icon:"🟢", label:"Ligeira" },
};
const ACAO = {
  contraindicado:"Contraindicado", monitorizar:"Monitorizar",
  informar_doente:"Informar doente", sem_acao:"Sem ação necessária",
};

export default function FarmaCheck() {
  const [input, setInput]     = useState("");
  const [drugs, setDrugs]     = useState([]);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState("all");
  const inputRef = useRef(null);

  const addDrug = () => {
    const name = input.trim();
    if (!name) return;
    if (drugs.find(d => d.toLowerCase() === name.toLowerCase())) { setInput(""); return; }
    setDrugs(prev => [...prev, name]);
    setInput(""); setResult(null); setError(null);
    inputRef.current?.focus();
  };

  const removeDrug = (name) => { setDrugs(prev => prev.filter(d => d !== name)); setResult(null); setError(null); };

  const check = async () => {
    if (drugs.length < 2) return;
    setLoading(true); setError(null); setResult(null); setFilter("all");
    try {
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are a clinical pharmacist expert in drug interactions for Portuguese community pharmacy. Accept drug names in Portuguese, brand names, or INNs. Reply ONLY with valid JSON, no markdown: {\"medicamentos_reconhecidos\":[\"name1\",\"name2\"],\"interacoes\":[{\"farmaco1\":\"name\",\"farmaco2\":\"name\",\"severidade\":\"grave|moderada|ligeira\",\"mecanismo\":\"brief mechanism\",\"consequencia\":\"clinical consequence\",\"recomendacao\":\"practical recommendation for community pharmacist\",\"acao\":\"contraindicado|monitorizar|informar_doente|sem_acao\"}],\"resumo\":\"global clinical summary\"}. Focus on ambulatory context, only clinically relevant interactions, reply in European Portuguese.",
          messages: [{ role: "user", content: "Check interactions between: " + drugs.join(", ") }]
        })
      });
      const data = await response.json();
      const text = data.content.map(i => i.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (e) {
      setError("Erro ao processar. Verifica a ligação e tenta novamente.");
    } finally {
      setLoading(false);
    }
  };

  const ints     = result?.interacoes || [];
  const filtered = filter === "all" ? ints : ints.filter(i => i.severidade === filter);
  const countSev = s => ints.filter(i => i.severidade === s).length;

  return (
    <div className="fc-root">
        <div className="fc-header">
          <div className="fc-logo">
            <div className="fc-logo-icon">⚕️</div>
            <div>
              <div className="fc-logo-name">FarmaCheck</div>
              <div className="fc-logo-sub">Interações medicamentosas · Farmácia comunitária PT</div>
            </div>
          </div>
        </div>
        <div className="fc-card">
          <div className="fc-input-row">
            <input ref={inputRef} className="fc-input" type="text" value={input}
              placeholder="Ex: omeprazol, clopidogrel, varfarina..."
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addDrug()} />
            <button className="fc-add-btn" onClick={addDrug}>+ Adicionar</button>
          </div>
          <p className="fc-input-hint">Aceita nomes em português, DCIs ou nomes comerciais · Enter para adicionar</p>
          {drugs.length > 0 && (
            <div className="fc-chips">
              {drugs.map(d => (
                <div key={d} className="fc-chip">
                  <span className="fc-chip-name">{d}</span>
                  <button className="fc-chip-rm" onClick={() => removeDrug(d)}>×</button>
                </div>
              ))}
            </div>
          )}
          <button className={`fc-check-btn ${drugs.length >= 2 && !loading ? "on" : "off"}`}
            onClick={check} disabled={drugs.length < 2 || loading}>
            {loading ? "A analisar..." : "Verificar Interações"}
          </button>
          {drugs.length === 1 && <p className="fc-hint-center">Adiciona pelo menos mais um medicamento</p>}
          {error && <div className="fc-error">⚠️ {error}</div>}
          {loading && (
            <div className="fc-loading">
              <div className="fc-spinner" />
              <div className="fc-loading-label">A processar</div>
              <div className="fc-loading-step">A analisar interações com IA clínica...</div>
            </div>
          )}
          {result && !loading && (
            <>
              <hr className="fc-divider" />
              {result.medicamentos_reconhecidos?.length > 0 && (
                <p style={{color:"#2d3f58",fontSize:"12px",marginBottom:"16px"}}>
                  Reconhecidos: <span style={{color:"#3b82f6"}}>{result.medicamentos_reconhecidos.join(" · ")}</span>
                </p>
              )}
              {result.resumo && (
                <div className="fc-summary">
                  <div className="fc-summary-label">Resumo clínico</div>
                  <div className="fc-summary-text">{result.resumo}</div>
                </div>
              )}
              {ints.length === 0 ? (
                <div className="fc-clear">
                  <div className="fc-clear-icon">✅</div>
                  <div className="fc-clear-title">Sem interações relevantes</div>
                  <div className="fc-clear-sub">Não foram identificadas interações clinicamente significativas<br/>para este conjunto de medicamentos no contexto ambulatório.</div>
                </div>
              ) : (
                <>
                  <div className="fc-filters">
                    {[{k:"all",l:`Todas (${ints.length})`},{k:"grave",l:`⛔ Grave (${countSev("grave")})`},{k:"moderada",l:`⚠️ Moderada (${countSev("moderada")})`},{k:"ligeira",l:`🟢 Ligeira (${countSev("ligeira")})`}]
                      .filter(f => f.k === "all" || countSev(f.k) > 0)
                      .map(f => (
                        <button key={f.k} className={`fc-fbtn ${filter === f.k ? "active" : "inactive"}`} onClick={() => setFilter(f.k)}>{f.l}</button>
                      ))}
                  </div>
                  <div className="fc-int-list">
                    {filtered.map((inter, idx) => {
                      const s = SEV[inter.severidade] || SEV.ligeira;
                      return (
                        <div key={idx} className={`fc-int-card ${s.cls}`} style={{animationDelay:`${idx*60}ms`}}>
                          <div className="fc-int-top">
                            <div className="fc-int-drugs">{inter.farmaco1} ↔ {inter.farmaco2}</div>
                            <div className="fc-badges">
                              <span className={`fc-sev-badge ${s.badge}`}>{s.icon} {s.label}</span>
                              <span className="fc-acao-badge">{ACAO[inter.acao] || inter.acao}</span>
                            </div>
                          </div>
                          <div className="fc-section">Mecanismo</div>
                          <div className="fc-mec">{inter.mecanismo}</div>
                          {inter.consequencia && (<><div className="fc-section">Consequência clínica</div><div className="fc-mec">{inter.consequencia}</div></>)}
                          <div className="fc-rec-box">
                            <div className="fc-section" style={{marginBottom:6}}>Recomendação</div>
                            <div className="fc-rec-text">{inter.recomendacao}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="fc-disclaimer">⚠️ <strong>Apoio à decisão clínica.</strong> Não substitui o julgamento profissional. Em situações críticas confirma com fontes primárias: RCM, Prontuário Terapêutico, Micromedex.</div>
            </>
          )}
        </div>
        <div className="fc-footer">FarmaCheck · Para farmacêuticos comunitários · Portugal</div>
      </div>
  );
}
