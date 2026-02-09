import { useState, useEffect, useRef, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, CartesianGrid } from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './App.css';

// --- [상수 및 설정] ---
const TABS = ["Main", "Practice", "Watchlist"];
const COLORS = ['#4F46E5', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6'];
const MENU_ITEMS = [
  { id: "Dashboard", label: "📊 자산 대시보드" },
  { id: "Dividends", label: "📅 배당 캘린더" },
  { id: "Journal", label: "📝 매매 일지" },
  { id: "Macro", label: "🌍 경제 일정" },
  { id: "Settings", label: "⚙️ 시스템 설정" }
];
const EMOTIONS = [
  { id: "FOMO", icon: "🔥", label: "뇌동" },
  { id: "FEAR", icon: "😨", label: "공포" },
  { id: "PLAN", icon: "😌", label: "원칙" },
  { id: "GREED", icon: "🤑", label: "탐욕" }
];

// --- [헬퍼 컴포넌트 & 함수] ---
const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  if (percent < 0.01) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="#64748B" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12" fontWeight="bold">{`${name} ${(percent * 100).toFixed(1)}%`}</text>;
};

const TradingViewWidget = ({ ticker }) => {
  const container = useRef();
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true, "symbol": ticker.includes("BTC") ? "BINANCE:BTCUSDT" : `NASDAQ:${ticker}`, "interval": "D", "timezone": "Asia/Seoul", "theme": "dark", "style": "1", "locale": "kr", "enable_publishing": false, "allow_symbol_change": true, "hide_side_toolbar": false, "calendar": false, "support_host": "https://www.tradingview.com"
    });
    container.current.innerHTML = ""; container.current.appendChild(script);
  }, [ticker]);
  return <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}></div>;
};

// 공통 스타일 생성기
const getStyles = (theme) => ({
  card: { background: theme.card, padding: '24px', borderRadius: '24px', border: '1px solid ' + theme.border, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' },
  input: { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid ' + theme.border, background: theme.bg, color: theme.text },
  button: { padding: '10px 18px', borderRadius: '14px', border: 'none', fontWeight: 'bold', cursor: 'pointer' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', animation: 'fadeIn 0.5s' }
});

// --- [하위 뷰 컴포넌트] ---
const DividendsView = ({ theme, currency, annualTotal, monthlyData, dividends, formatMoney }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', animation: 'fadeIn 0.5s' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ ...getStyles(theme).card, padding: '30px' }}>
        <h3 style={{ marginTop: 0, color: theme.subText, fontSize: '14px' }}>연간 예상 배당금</h3>
        <div style={{ fontSize: '32px', fontWeight: '900', color: '#10B981' }}>{formatMoney(annualTotal)}</div>
        <p>월 평균 <strong style={{ color: '#6366F1' }}>{formatMoney(annualTotal / 12)}</strong></p>
      </div>
      <div style={{ ...getStyles(theme).card, flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>📋 배당 상세</h3>
        {dividends.length > 0 ? dividends.map((d, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid ' + theme.border, display: 'flex', justifyContent: 'space-between' }}>
            <strong>{d.Ticker}</strong>
            <span style={{ color: '#10B981' }}>${parseFloat(d.Amount).toFixed(2)} ({d.Frequency}회)</span>
          </div>
        )) : <div style={{ padding: '20px', color: theme.subText }}>배당 정보가 없습니다.</div>}
      </div>
    </div>
    <div style={{ ...getStyles(theme).card, padding: '30px' }}>
      <h2 style={{ marginTop: 0 }}>📊 월별 수령 계획 ({currency})</h2>
      <ResponsiveContainer width="100%" height="90%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} /><XAxis dataKey="name" /><Tooltip formatter={(value) => formatMoney(value)} cursor={{ fill: 'transparent' }} /><Bar dataKey="value" fill="#6366F1" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer>
    </div>
  </div>
);

const JournalView = ({ theme, journalInput, setJournalInput, stocks, saveJournal, editingJournalIndex, setEditingJournalIndex, journalFilter, setJournalFilter, analyzeJournal, filteredJournal, startEditJournal, deleteJournal }) => (
  <div style={getStyles(theme).grid2}>
    <div className="journal-form-container" style={{ ...getStyles(theme).card, padding: '30px' }}>
      <h2 style={{ marginTop: 0 }}>{editingJournalIndex !== null ? "✍️ 일지 수정하기" : "✍️ 오늘의 기록"}</h2>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', color: theme.subText }}>종목 선택</label>
        <select value={journalInput.ticker} onChange={(e) => setJournalInput({ ...journalInput, ticker: e.target.value })} style={{ ...getStyles(theme).input, marginTop: '5px' }}>
          <option value="">종목을 선택하세요</option>{stocks.map(s => <option key={s.Ticker} value={s.Ticker}>{s.Ticker}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', color: theme.subText }}>매매 기준</label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
          {['BUY', 'SELL', 'HOLD'].map(type => (
            <button key={type} onClick={() => setJournalInput({ ...journalInput, action: type })} style={{ ...getStyles(theme).button, flex: 1, border: '1px solid ' + theme.border, background: journalInput.action === type ? (type === 'BUY' ? '#EF4444' : type === 'SELL' ? '#3B82F6' : '#F59E0B') : theme.bg, color: journalInput.action === type ? 'white' : theme.text }}>{type}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', color: theme.subText }}>당시 감정</label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
          {EMOTIONS.map(emo => (
            <button key={emo.id} onClick={() => setJournalInput({ ...journalInput, emotion: emo.id })} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: journalInput.emotion === emo.id ? '2px solid #6366F1' : '1px solid ' + theme.border, background: theme.bg, fontSize: '20px', cursor: 'pointer' }} title={emo.label}>{emo.icon}</button>
          ))}
        </div>
      </div>
      <textarea value={journalInput.content} onChange={(e) => setJournalInput({ ...journalInput, content: e.target.value })} placeholder="이유를 적어주세요." style={{ ...getStyles(theme).input, height: '100px', resize: 'none', marginTop: '10px' }} />
      <button style={{ ...getStyles(theme).button, width: '100%', padding: '15px', background: editingJournalIndex !== null ? '#F59E0B' : '#4F46E5', color: 'white', marginTop: '20px' }} onClick={saveJournal}>{editingJournalIndex !== null ? "수정 완료" : "일지 저장하기"}</button>
      {editingJournalIndex !== null && <button onClick={() => { setEditingJournalIndex(null); setJournalInput({ date: new Date().toISOString().split('T')[0], ticker: "", action: "BUY", emotion: "PLAN", content: "" }); }} style={{ width: '100%', padding: '10px', background: 'transparent', color: theme.subText, border: 'none', cursor: 'pointer' }}>취소</button>}
    </div>

    <div style={{ ...getStyles(theme).card, padding: '30px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📖 타임라인</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select value={journalFilter} onChange={(e) => setJournalFilter(e.target.value)} style={{ ...getStyles(theme).input, width: 'auto', padding: '5px' }}>
            <option value="ALL">전체 보기</option>{stocks.map(s => <option key={s.Ticker} value={s.Ticker}>{s.Ticker}</option>)}
          </select>
          <button onClick={analyzeJournal} style={{ padding: '8px 16px', borderRadius: '20px', background: '#EEF2FF', color: '#4F46E5', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>🤖 분석</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '600px' }}>
        {filteredJournal.length > 0 ? filteredJournal.map((j, i) => (
          <div key={i} style={{ marginBottom: '15px', padding: '20px', borderRadius: '16px', background: theme.bg, borderLeft: `4px solid ${j.Category === 'BUY' ? '#EF4444' : j.Category === 'SELL' ? '#3B82F6' : '#F59E0B'}`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' }}>
              <button onClick={() => startEditJournal(j, i)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>
              <button onClick={() => deleteJournal(i)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>🗑️</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontWeight: 'bold' }}>{j.Ticker}</span><span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: j.Category === 'BUY' ? '#FEE2E2' : '#DBEAFE', color: j.Category === 'BUY' ? '#EF4444' : '#3B82F6' }}>{j.Category}</span></div>
              <span style={{ fontSize: '12px', color: theme.subText }}>{j.Date?.split('T')[0]}</span>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', lineHeight: '1.5' }}>{j.Content}</p>
            <div style={{ fontSize: '12px', color: theme.subText }}>감정: <span style={{ fontSize: '16px' }}>{j.AI_Insight === 'FOMO' ? '🔥' : j.AI_Insight === 'FEAR' ? '😨' : j.AI_Insight === 'GREED' ? '🤑' : '😌'}</span></div>
          </div>
        )) : <div style={{ textAlign: 'center', padding: '40px', color: theme.subText }}>작성된 일지가 없습니다.</div>}
      </div>
    </div>
  </div>
);

const MacroView = ({ theme, macro, analyzeMacro }) => {
  const nextEvent = macro[0] || null;
  return (
    <div style={{ ...getStyles(theme).grid2, gridTemplateColumns: '1.5fr 1fr' }}>
      <div style={{ ...getStyles(theme).card, padding: '30px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>📅 경제 캘린더</h2>
          <span style={{ fontSize: '12px', background: '#FEF2F2', color: '#EF4444', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold' }}>High Impact</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px' }}>
          {macro.map((m, i) => (
            <div key={i} style={{ padding: '16px', marginBottom: '12px', borderRadius: '16px', background: theme.bg, border: '1px solid ' + theme.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontWeight: 'bold' }}>{m.Event}</span><span style={{ fontSize: '11px', background: '#EF4444', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>🔥🔥🔥</span></div>
                <span style={{ fontSize: '12px', color: theme.subText }}>{m.Date} | {m.Time}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px' }}>
                <div>실제: <strong style={{ color: m.Actual !== '-' ? '#10B981' : theme.text }}>{m.Actual}</strong></div>
                <div style={{ color: theme.subText }}>예상: {m.Forecast}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: '#4F46E5', padding: '30px', borderRadius: '24px', color: 'white', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)' }}>
          <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '10px' }}>Next Big Event</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>{nextEvent ? nextEvent.Event : "일정 없음"}</div>
          <div style={{ fontSize: '48px', fontWeight: '900' }}>{nextEvent ? "D-Day" : "-"}</div>
        </div>
        <div style={{ ...getStyles(theme).card, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3>🤖 Macro Briefing</h3>
            <button onClick={() => analyzeMacro(macro)} style={{ padding: '6px 12px', borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>AI 분석 실행</button>
          </div>
          <p style={{ fontSize: '14px', lineHeight: '1.6' }}>이번 주 경제 지표를 Gemini에게 분석 요청해보세요.</p>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ theme, config, setConfig, onSave }) => (
  <div style={{ ...getStyles(theme).card, maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
    <h2 style={{ marginTop: 0, marginBottom: '20px' }}>⚙️ 시스템 설정</h2>
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Google Apps Script URL (API)</label>
      <input type="text" value={config.apiUrl} onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })} placeholder="https://script.google.com/macros/s/..." style={{ ...getStyles(theme).input }} />
    </div>
    <div style={{ marginBottom: '30px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Gemini API Key</label>
      <input type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="AIza..." style={{ ...getStyles(theme).input }} />
    </div>
    <button onClick={onSave} style={{ ...getStyles(theme).button, width: '100%', background: '#4F46E5', color: 'white', padding: '15px', fontSize: '16px' }}>설정 저장하기</button>
  </div>
);

const DashboardView = ({ theme, currency, isDarkMode, goalAmount, setGoalAmount, progress, history, currentTab, setCurrentTab, stocks, formatMoney, setSelectedStock, setEditStock, calculateRebalancing, totalValue, getExchangeRate, gurus, askGemini }) => (
  <div className="dashboard-grid">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={getStyles(theme).card}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>🎯 투자 목표 ({currency})</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: theme.subText }}>목표 금액 ($)</label>
          <input type="number" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} style={{ ...getStyles(theme).input, fontWeight: 'bold' }} />
        </div>
        <div style={{ background: isDarkMode ? '#334155' : '#E2E8F0', borderRadius: '20px', height: '10px', overflow: 'hidden' }}><div style={{ width: `${progress}%`, background: '#10B981', height: '100%' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}><span style={{ fontSize: '12px', color: theme.subText }}>달성률</span><span style={{ fontSize: '14px', fontWeight: 'bold', color: '#10B981' }}>{progress}%</span></div>
      </div>
      <div style={{ ...getStyles(theme).card, flex: 1, minHeight: '300px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px', marginBottom: '20px' }}>📉 월별 자산 추이</h3>
        <ResponsiveContainer width="100%" height={250}><LineChart data={history}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="Month" /><Tooltip formatter={(value) => formatMoney(value)} /><Line type="monotone" dataKey="Value" stroke="#6366F1" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
      </div>
    </div>

    <div style={getStyles(theme).card}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>{TABS.map(t => <button key={t} onClick={() => setCurrentTab(t)} style={{ ...getStyles(theme).button, background: currentTab === t ? '#1E293B' : theme.bg, color: currentTab === t ? 'white' : theme.subText }}>{t}</button>)}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: theme.subText, borderBottom: '1px solid ' + theme.border }}><th style={{ padding: '12px', textAlign: 'left' }}>Asset</th><th>Weight</th><th>Val ({currency})</th><th>Rebalance</th><th>Edit</th></tr></thead>
        <tbody>{stocks.map((s, i) => (
          <tr key={i} onClick={() => setSelectedStock(s.Ticker)} style={{ borderBottom: '1px solid ' + theme.border, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = isDarkMode ? '#334155' : '#F1F5F9'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <td style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><img src={`https://assets.parqet.com/logos/symbol/${s.Ticker}?format=png`} style={{ width: '24px' }} onError={(e) => { e.target.style.display = 'none' }} /></div>
              <div><strong>{s.Ticker}</strong><br /><span style={{ fontSize: '11px', color: theme.subText }}>{formatMoney(s.CurrentPrice)}</span></div>
            </td>
            <td style={{ textAlign: 'center' }}><div style={{ fontWeight: 'bold' }}>{(s.CurrentRatio * 100).toFixed(1)}%</div><div style={{ fontSize: '11px', color: theme.subText }}>목표: {(s.TargetRatio * 100).toFixed(1)}%</div></td>
            <td style={{ textAlign: 'center', fontWeight: 'bold', color: s.ReturnRate >= 0 ? '#EF4444' : '#3B82F6' }}>{formatMoney(s.Value)}</td>
            <td style={{ textAlign: 'center', fontSize: '13px' }}>{calculateRebalancing(s)}</td>
            <td style={{ textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); setEditStock(s); }}><button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✏️</button></td>
          </tr>))}</tbody>
      </table>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: '#1E293B', padding: '30px', borderRadius: '24px', color: 'white', textAlign: 'center' }}>
        <div style={{ opacity: 0.7 }}>Total Assets</div>
        <div style={{ fontSize: '36px', fontWeight: '900', color: '#10B981' }}>{formatMoney(totalValue)}</div>
        <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '5px' }}>환율: {getExchangeRate().toFixed(0)}원/$</div>
      </div>
      <div style={{ ...getStyles(theme).card, height: '280px', padding: '20px' }}>
        <ResponsiveContainer><PieChart><Pie data={stocks} dataKey="Value" nameKey="Ticker" cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} cornerRadius={6} label={renderCustomizedLabel}>{stocks.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatMoney(value)} /></PieChart></ResponsiveContainer>
      </div>
      <div style={{ background: '#1E293B', padding: '24px', borderRadius: '24px', color: 'white', flex: 1 }}>
        <h4>🐋 Whale Watch</h4>
        {gurus.length > 0 ? gurus.map((g, i) => (<div key={i} onClick={() => askGemini(g)} style={{ padding: '14px', background: '#334155', borderRadius: '16px', marginBottom: '8px', cursor: 'pointer' }}><strong>{g.Icon} {g.Name}</strong><br />{g.Move}</div>))
          : <div style={{ color: '#94A3B8', textAlign: 'center', marginTop: '20px' }}>데이터 없음<br/><span style={{fontSize:'12px'}}>(설정에서 API 연결 확인)</span></div>}
      </div>
    </div>
  </div>
);

// --- [Main App] ---
function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("Dashboard");
  const [currentTab, setCurrentTab] = useState("Main");
  const [currency, setCurrency] = useState("USD");
  const [selectedStock, setSelectedStock] = useState(null);
  const [editStock, setEditStock] = useState(null);
  const [analysisModal, setAnalysisModal] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [goalAmount, setGoalAmount] = useState(100000);
  
  // Settings & Data States
  const [config, setConfig] = useState({ apiUrl: "", apiKey: "" });
  const [stocks, setStocks] = useState([]);
  const [marketIndices, setMarketIndices] = useState([]);
  const [cryptoIndices, setCryptoIndices] = useState({});
  const [gurus, setGurus] = useState([]);
  const [history, setHistory] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [journal, setJournal] = useState([]);
  const [macro, setMacro] = useState([]);
  const [totalValue, setTotalValue] = useState(0);

  // Journal States
  const [journalInput, setJournalInput] = useState({ date: new Date().toISOString().split('T')[0], ticker: "", action: "BUY", emotion: "PLAN", content: "" });
  const [journalFilter, setJournalFilter] = useState("ALL");
  const [editingJournalIndex, setEditingJournalIndex] = useState(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem("appConfig");
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    } else {
      setConfig({ apiUrl: import.meta.env.VITE_STOCK_API_URL || "", apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem("appConfig", JSON.stringify(config));
    alert("설정이 저장되었습니다. 새로고침 시 적용됩니다.");
    fetchData(); // 즉시 재조회
  };

  const theme = useMemo(() => ({
    bg: isDarkMode ? '#0F172A' : '#F8FAFC',
    card: isDarkMode ? '#1E293B' : '#FFFFFF',
    text: isDarkMode ? '#F8FAFC' : '#1E293B',
    subText: isDarkMode ? '#94A3B8' : '#64748B',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    nav: '#1E293B'
  }), [isDarkMode]);

  const getExchangeRate = () => cryptoIndices.USD || 1450;
  const formatMoney = (value) => {
    if (currency === "KRW") {
      const valInKrw = value * getExchangeRate();
      return valInKrw >= 100000000 ? `₩${(valInKrw / 100000000).toFixed(2)}억` : `₩${(valInKrw / 10000).toFixed(0)}만`;
    }
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const fetchData = async () => {
    if (!config.apiUrl) return;
    try {
      const res = await fetch(`${config.apiUrl}?sheetName=${currentTab}`);
      const data = await res.json();
      
      if (data.indices) setMarketIndices(data.indices);
      if (data.gurus) setGurus(data.gurus);
      if (data.history) setHistory(data.history);
      if (data.dividends) setDividends(data.dividends);
      if (data.macro) setMacro(data.macro);
      if (data.journal) setJournal(data.journal.reverse());
      if (data.crypto) setCryptoIndices(prev => ({ ...prev, ...data.crypto }));

      const pData = data.portfolio || [];
      const currentUsd = (pData.find(r => r.Ticker === 'USDKRW'))?.CurrentPrice || 1440;
      setCryptoIndices(prev => ({ ...prev, USD: currentUsd }));

      let sum = 0;
      const processed = pData.filter(r => !r.Ticker.includes('KRW')).map(s => {
        let price = (['USD', 'CASH'].includes(s.Ticker)) ? 1 : s.CurrentPrice || 0;
        const val = price * (s.Qty || 0);
        sum += val;
        return { ...s, CurrentPrice: price, Value: val };
      });
      setTotalValue(sum);
      setStocks(processed.sort((a, b) => b.Value - a.Value).map(s => ({
        ...s, CurrentRatio: sum > 0 ? (s.Value / sum) : 0,
        ReturnRate: (s.AvgPrice > 0 ? ((s.CurrentPrice - s.AvgPrice) / s.AvgPrice) * 100 : 0).toFixed(2)
      })));
    } catch (e) { console.error("Fetch Error:", e); }
  };

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 60000); return () => clearInterval(interval); }, [currentTab, config.apiUrl]);

  const { monthlyData, annualTotal } = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({ name: `${i + 1}월`, value: 0 }));
    let total = 0;
    stocks.forEach(stock => {
      const div = dividends.find(d => d.Ticker === stock.Ticker);
      if (div?.Amount > 0) {
        const amt = parseFloat(div.Amount) * (parseFloat(stock.Qty) || 0) * (parseInt(div.Frequency) || 4);
        total += amt;
        const start = div.PayDate ? new Date(div.PayDate).getMonth() : 0;
        const freq = parseInt(div.Frequency) || 4;
        for (let i = 0; i < freq; i++) data[Math.floor((start + (i * (12 / freq))) % 12)].value += (amt / freq);
      }
    });
    return { monthlyData: data.map(d => ({ ...d, value: currency === 'KRW' ? d.value * getExchangeRate() : d.value })), annualTotal: total };
  }, [stocks, dividends, currency, cryptoIndices]);

  const callApi = async (body) => {
    if (!config.apiUrl) return alert("설정에서 API URL을 입력해주세요.");
    try {
      await fetch(config.apiUrl, { method: "POST", body: JSON.stringify(body) });
      return true;
    } catch (e) { alert("서버 통신 실패"); return false; }
  };

  const handleEditSave = async () => {
    if (editStock && await callApi({ action: "update", Ticker: editStock.Ticker, TargetRatio: editStock.TargetRatio || 0, Qty: editStock.Qty, AvgPrice: editStock.AvgPrice })) {
      alert("수정되었습니다!"); setEditStock(null); fetchData();
    }
  };

  const saveJournal = async () => {
    if (!journalInput.ticker || !journalInput.content) return alert("종목과 내용을 입력해주세요.");
    const isEdit = editingJournalIndex !== null;
    const entry = { Date: journalInput.date, Ticker: journalInput.ticker, Category: journalInput.action, Content: journalInput.content, AI_Insight: journalInput.emotion };
    
    let updatedJournal = [...journal];
    if (isEdit) updatedJournal[editingJournalIndex] = entry;
    else updatedJournal = [entry, ...journal];
    setJournal(updatedJournal); setEditingJournalIndex(null);
    setJournalInput({ date: new Date().toISOString().split('T')[0], ticker: "", action: "BUY", emotion: "PLAN", content: "" });

    const original = isEdit ? journal[editingJournalIndex] : null;
    const payload = isEdit 
      ? { type: "JOURNAL_UPDATE", original: { date: original.Date, ticker: original.Ticker, action: original.Category, content: original.Content }, new: { ...entry, emotion: entry.AI_Insight } }
      : { type: "JOURNAL", ...journalInput };
    
    if (await callApi(payload)) alert(isEdit ? "수정 완료!" : "저장 완료");
  };

  const deleteJournal = async (index) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    const target = journal[index];
    setJournal(journal.filter((_, i) => i !== index));
    await callApi({ type: "JOURNAL_DELETE", original: { date: target.Date, ticker: target.Ticker, action: target.Category, content: target.Content } });
  };

  const callGemini = async (title, promptText, loadingText) => {
    if (!config.apiKey) return alert("설정에서 Gemini API Key를 입력해주세요.");
    setLoadingMsg(loadingText); setAnalysisModal({ title, loading: true });
    try {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await model.generateContent(promptText);
      setAnalysisModal({ title, content: res.response.text(), loading: false });
    } catch (e) { setAnalysisModal({ title: "Error", content: "분석 실패 (API Key 확인 필요)", loading: false }); }
  };

  const analyzeJournal = () => callGemini("📊 AI 투자 코칭", `다음은 나의 최근 주식 매매 일지야. 내 투자 심리 상태와 개선점을 냉철하게 분석해서 3줄로 조언해줘:\n\n${journal.slice(0, 5).map(j => `[${j.Date}] ${j.Category} ${j.Ticker}: ${j.Content} (감정: ${j.AI_Insight})`).join("\n")}`, "매매 기록 분석 중... 🧠");
  const askGemini = (payload) => callGemini(payload.Name, `${payload.Name}의 최근 활동 "${payload.Move}" 분석해줘.`, "Gemini 분석 중...");
  const analyzeMacro = (data) => callGemini("🌍 이번 주 경제 브리핑", `다음 경제 일정을 보고, 투자자가 주목해야 할 포인트와 시장에 미칠 영향을 3줄로 요약해줘:\n\n${data.map(m => `${m.Date} ${m.Time}: ${m.Event} (예상: ${m.Forecast})`).join("\n")}`, "경제 지표 분석 중...");

  const calculateRebalancing = (stock) => {
    if (!totalValue || !stock.CurrentPrice) return "-";
    const qtyNeeded = Math.round((totalValue * (stock.TargetRatio || 0) - stock.Value) / stock.CurrentPrice);
    if (qtyNeeded === 0) return <span style={{ color: theme.subText }}>적정</span>;
    return <span style={{ color: qtyNeeded > 0 ? '#EF4444' : '#3B82F6', fontWeight: 'bold' }}>{qtyNeeded > 0 ? '+' : ''}{qtyNeeded}주</span>;
  };

  const tickerData = marketIndices.length > 0 ? [...marketIndices, ...marketIndices] : [{ Name: "Loading...", Price: 0, Change: 0 }];
  const styles = getStyles(theme);

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: '100vh', padding: '20px', color: theme.text, fontFamily: 'Pretendard, sans-serif', transition: 'all 0.3s' }}>
      <div style={{ position: 'fixed', top: 0, left: isSidebarOpen ? 0 : '-280px', width: '280px', height: '100%', background: theme.card, boxShadow: '5px 0 15px rgba(0,0,0,0.1)', zIndex: 2000, transition: 'left 0.3s ease', padding: '30px', boxSizing: 'border-box', borderRight: '1px solid ' + theme.border }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}><h2>메뉴</h2><button onClick={() => setIsSidebarOpen(false)} style={{ border: 'none', background: 'none', fontSize: '24px', color: theme.text }}>✕</button></div>
        {MENU_ITEMS.map(item => (<button key={item.id} onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }} style={{ width: '100%', padding: '15px', textAlign: 'left', borderRadius: '12px', border: 'none', background: currentView === item.id ? '#EEF2FF' : 'transparent', color: currentView === item.id ? '#4F46E5' : theme.text, fontWeight: 'bold', marginBottom: '10px' }}>{item.label}</button>))}
      </div>
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1999 }} />}

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', height: '50px' }}>
        <button onClick={() => setIsSidebarOpen(true)} style={{ background: theme.nav, color: 'white', border: 'none', borderRadius: '12px', width: '50px', fontSize: '24px', cursor: 'pointer' }}>☰</button>
        <div style={{ flex: 1, background: theme.nav, color: 'white', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .ticker-wrapper { display: flex; animation: ticker 60s linear infinite; white-space: nowrap; } .ticker-item { margin: 0 25px; font-size: 14px; display: flex; align-items: center; gap: 6px; }`}</style>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30px', background: 'linear-gradient(to right, rgba(30,41,59,1), transparent)', zIndex: 10 }}></div>
          <div className="ticker-wrapper">
            {tickerData.map((idx, i) => (<span key={i} className="ticker-item"><span style={{ fontWeight: 'bold', color: '#94A3B8' }}>{idx.Name}:</span> <strong>{typeof idx.Price === 'number' ? idx.Price.toFixed(2) : idx.Price}</strong> <span style={{ color: idx.Change > 0 ? '#4ADE80' : '#F87171', fontSize: '12px' }}>({idx.Change > 0 ? '+' : ''}{Number(idx.Change).toFixed(2)}%)</span></span>))}
            <span className="ticker-item">🪙 BTC: <strong style={{ color: '#FCD34D' }}>${cryptoIndices.BTC?.toLocaleString()}</strong></span>
            <span className="ticker-item">💸 USD: <strong style={{ color: '#6EE7B7' }}>{cryptoIndices.USD?.toFixed(0)}원</strong></span>
          </div>
        </div>
        <button onClick={() => setCurrency(currency === "USD" ? "KRW" : "USD")} style={{ ...styles.button, background: theme.card, color: theme.text, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>{currency === "USD" ? "🇺🇸 USD" : "🇰🇷 KRW"}</button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ ...styles.button, width: '50px', fontSize: '20px', background: theme.card, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>{isDarkMode ? '☀️' : '🌙'}</button>
      </div>

      {currentView === "Dividends" && <DividendsView theme={theme} currency={currency} annualTotal={annualTotal} monthlyData={monthlyData} dividends={dividends} formatMoney={formatMoney} />}
      {currentView === "Journal" && <JournalView theme={theme} journalInput={journalInput} setJournalInput={setJournalInput} stocks={stocks} saveJournal={saveJournal} editingJournalIndex={editingJournalIndex} setEditingJournalIndex={setEditingJournalIndex} journalFilter={journalFilter} setJournalFilter={setJournalFilter} analyzeJournal={analyzeJournal} filteredJournal={journalFilter === "ALL" ? journal : journal.filter(j => j.Ticker === journalFilter)} startEditJournal={(j, i) => { setJournalInput({ date: j.Date?.split('T')[0], ticker: j.Ticker, action: j.Category, emotion: j.AI_Insight, content: j.Content }); setEditingJournalIndex(i); document.querySelector('.journal-form-container')?.scrollIntoView({ behavior: 'smooth' }); }} deleteJournal={deleteJournal} />}
      {currentView === "Macro" && <MacroView theme={theme} macro={macro} analyzeMacro={analyzeMacro} />}
      {currentView === "Settings" && <SettingsView theme={theme} config={config} setConfig={setConfig} onSave={saveConfig} />}
      {currentView === "Dashboard" && <DashboardView theme={theme} currency={currency} isDarkMode={isDarkMode} goalAmount={goalAmount} setGoalAmount={setGoalAmount} progress={goalAmount > 0 ? Math.min((totalValue / goalAmount) * 100, 100).toFixed(1) : 0} history={history} currentTab={currentTab} setCurrentTab={setCurrentTab} stocks={stocks} formatMoney={formatMoney} setSelectedStock={setSelectedStock} setEditStock={setEditStock} calculateRebalancing={calculateRebalancing} totalValue={totalValue} getExchangeRate={getExchangeRate} gurus={gurus} askGemini={askGemini} />}

      {selectedStock && <div className="modal-overlay" onClick={() => setSelectedStock(null)}><div className="modal-content" onClick={e => e.stopPropagation()}><button onClick={() => setSelectedStock(null)} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: '#333', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>✕ 닫기</button><TradingViewWidget ticker={selectedStock} /></div></div>}

      {editStock && (
        <div className="modal-overlay" onClick={() => setEditStock(null)}>
          <div style={{ ...styles.card, width: '90%', maxWidth: '400px', padding: '30px' }} onClick={e => e.stopPropagation()}>
            <h3>✏️ {editStock.Ticker} 수정</h3>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: theme.subText }}>목표 비중 (Target Ratio, 0.1 = 10%)</label>
            <input type="number" step="0.01" value={editStock.TargetRatio} onChange={e => setEditStock({ ...editStock, TargetRatio: e.target.value })} style={{ ...styles.input, marginBottom: '20px' }} />
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: theme.subText }}>보유 수량 (Qty)</label>
            <input type="number" value={editStock.Qty} onChange={e => setEditStock({ ...editStock, Qty: e.target.value })} style={{ ...styles.input, marginBottom: '20px' }} />
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: theme.subText }}>평단가 (Avg Price)</label>
            <input type="number" value={editStock.AvgPrice} onChange={e => setEditStock({ ...editStock, AvgPrice: e.target.value })} style={{ ...styles.input, marginBottom: '20px' }} />
            <button onClick={handleEditSave} style={{ ...styles.button, width: '100%', background: '#4F46E5', color: 'white' }}>저장하기</button>
          </div>
        </div>
      )}

      {analysisModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '90%', maxWidth: '450px', padding: '30px', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setAnalysisModal(null)} style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', background: 'none', fontSize: '20px', color: theme.subText }}>✕</button>
            <h3>🤖 AI Insight</h3>
            <p style={{ fontWeight: 'bold', marginBottom: '15px', color: '#6366F1' }}>{analysisModal.title}</p>
            {analysisModal.loading ? <div style={{ textAlign: 'center', padding: '20px' }}><div style={{ fontSize: '30px' }}>⏳</div><p>{loadingMsg}</p></div> : <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{analysisModal.content}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;