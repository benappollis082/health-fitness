import { useState, useRef, useCallback, useMemo, useEffect } from "react";

const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];
const YEARS = [2026, 2027, 2028, 2029, 2030];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

function getMonthInfo(year) {
  return MONTH_NAMES.map((name, i) => {
    const d = new Date(year, i, 1);
    const startDow = (d.getDay() + 6) % 7; 
    const days = new Date(year, i + 1, 0).getDate();
    return { name, days, startDow };
  });
}

const CATEGORIES = [
  { key: "gym",       label: "Gym" },
  { key: "movement",  label: "Movement (km)" },
  { key: "nutrition", label: "Nutrition" },
  { key: "sleep",     label: "Sleep (h)" },
];

const HEALTH_METRICS = [
  { key: "bloodsugar",   label: "Blood Sugar",    unit: "mmol/L", placeholder: "e.g. 5.4",   color: "#d4601a", light: "#fdf0e0", text: "#a03a10" },
  { key: "bloodpressure",label: "Blood Pressure", unit: "mmHg",  placeholder: "e.g. 120/80", color: "#c03070", light: "#fde8f0", text: "#902050" },
  { key: "weight",       label: "Weight",         unit: "kg",    placeholder: "e.g. 78.5",   color: "#5a7aaa", light: "#e8eef8", text: "#3a5a8a" },
];

const CAT_COLORS = {
  gym:       { bg: "#e8623a", text: "#c94f1e", light: "#fde8d8" },
  movement:  { bg: "#6aaa3a", text: "#4a7a2a", light: "#e8f5d8" },
  nutrition: { bg: "#3a7aaa", text: "#2a5a8a", light: "#d8eaf8" },
  sleep:     { bg: "#8a6aaa", text: "#6a4a8a", light: "#ede8f8" },
};

const NUMERIC_KEYS = ["sleep", "movement"];

function buildInitialState() {
  const s = {};
  YEARS.forEach(year => {
    getMonthInfo(year).forEach(({ name, days }) => {
      CATEGORIES.forEach(({ key }) => {
        for (let d = 1; d <= days; d++) s[`${year}-${name}-${key}-${d}`] = { checked: false, value: "" };
      });
      HEALTH_METRICS.forEach(({ key }) => {
        for (let d = 1; d <= days; d++) s[`${year}-${name}-${key}-${d}`] = { value: "" };
      });
    });
  });
  return s;
}

function isCellDone(cell, key) {
  if (!cell) return false;
  if (NUMERIC_KEYS.includes(key)) return cell.value !== "" && parseFloat(cell.value) > 0;
  return cell.checked;
}

function sleepColor(hours, goal) {
  const h = parseFloat(hours);
  if (isNaN(h) || h <= 0) return { bg: "transparent", text: "#cbbfa8", missedGoal: false };
  const missedGoal = h < goal;
  if (h < 5)  return { bg: "#e05050", text: "#fff", missedGoal };
  if (h < 6)  return { bg: "#e8823a", text: "#fff", missedGoal };
  if (h < 7)  return { bg: "#d4a820", text: "#fff", missedGoal };
  if (h < 8)  return { bg: "#6aaa3a", text: "#fff", missedGoal };
  return        { bg: "#3a8a5a", text: "#fff", missedGoal };
}

function movementColor(km, goal) {
  const k = parseFloat(km);
  if (isNaN(k) || k <= 0) return { bg: "transparent", text: "#cbbfa8", missedGoal: false };
  const missedGoal = k < goal;
  if (k < 2)  return { bg: "#b8d4a0", text: "#fff", missedGoal };
  if (k < 5)  return { bg: "#6aaa3a", text: "#fff", missedGoal };
  if (k < 8)  return { bg: "#3a8a3a", text: "#fff", missedGoal };
  if (k < 12) return { bg: "#2a6a5a", text: "#fff", missedGoal };
  return        { bg: "#1a4a3a", text: "#fff", missedGoal };
}

function computeGlobalStreak(cells, key) {
  const allDays = [];
  YEARS.forEach(year => {
    getMonthInfo(year).forEach(({ name, days }) => {
      for (let d = 1; d <= days; d++) allDays.push(`${year}-${name}-${key}-${d}`);
    });
  });
  let lastFilledIdx = -1;
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (isCellDone(cells[allDays[i]], key)) { lastFilledIdx = i; break; }
  }
  if (lastFilledIdx === -1) return 0;
  let streak = 0;
  for (let i = lastFilledIdx; i >= 0; i--) {
    if (isCellDone(cells[allDays[i]], key)) streak++;
    else break;
  }
  return streak;
}

function computeMonthBestStreak(cells, year, monthName, days, key) {
  let best = 0, cur = 0;
  for (let d = 1; d <= days; d++) {
    if (isCellDone(cells[`${year}-${monthName}-${key}-${d}`], key)) { cur++; if (cur > best) best = cur; }
    else cur = 0;
  }
  return best;
}

export default function FitnessAndHealthGoals() {
  const [cells, setCells] = useState(buildInitialState);
  const [editing, setEditing] = useState(null);
  const [activeYear, setActiveYear] = useState(2026);
  const [activeMonth, setActiveMonth] = useState("January");
  const [sleepGoal, setSleepGoal] = useState(7.5);
  const [movementGoal, setMovementGoal] = useState(8);
  const [editingGoal, setEditingGoal] = useState(null);
  const [dbToast, setDbToast] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [activeUser, setActiveUser] = useState("");
  const [dbData, setDbData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const inputRef = useRef(null);
  const healthInputRef = useRef(null);
  const goalInputRef = useRef(null);

  const loadUserData = useCallback((user, data) => {
    let userObj = {};
    if (data.userData && data.userData[user]) {
        userObj = data.userData[user];
    } else if (user === "Ben_A" && data.cells) {
        userObj = { cells: data.cells, sleepGoal: data.sleepGoal, movementGoal: data.movementGoal };
    }

    if (userObj.cells) {
        const migratedCells = { ...buildInitialState() };
        Object.keys(userObj.cells).forEach(k => {
           if (k.match(/^[A-Z][a-z]+-/)) {
              migratedCells[`2026-${k}`] = userObj.cells[k];
           } else {
              migratedCells[k] = userObj.cells[k];
           }
        });
        setCells(migratedCells);
    } else {
        setCells(buildInitialState());
    }
    setSleepGoal(userObj.sleepGoal || 7.5);
    setMovementGoal(userObj.movementGoal || 8);
  }, []);

  useEffect(() => {
    const API_URL = import.meta.env.PROD ? '/api/data' : 'http://localhost:3000/api/data';
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        setDbData(data);
        const users = data.users || [];
        setUsersList(users);
        const firstUser = users.length > 0 ? users[0] : "Ben_A";
        setActiveUser(firstUser);
        loadUserData(firstUser, data);
      })
      .catch(err => console.error("Error loading from database:", err));
  }, [loadUserData]);

  const handleUserChange = (e) => {
    const newUser = e.target.value;
    setActiveUser(newUser);
    if (dbData) loadUserData(newUser, dbData);
  };

  const exportCSV = useCallback(() => {
    let csv = "User,Date,Gym,Movement(km),Nutrition,Sleep(h),Blood Sugar(mmol/L),Blood Pressure(mmHg),Weight(kg)\n";
    
    YEARS.forEach(year => {
      getMonthInfo(year).forEach(({ name, days, monthIndex }) => {
        for (let d = 1; d <= days; d++) {
          const gym = cells[`${year}-${name}-gym-${d}`]?.checked ? "Yes" : "No";
          const movement = cells[`${year}-${name}-movement-${d}`]?.value || "";
          const nutrition = cells[`${year}-${name}-nutrition-${d}`]?.checked ? "Yes" : "No";
          const sleep = cells[`${year}-${name}-sleep-${d}`]?.value || "";
          const bloodsugar = cells[`${year}-${name}-bloodsugar-${d}`]?.value || "";
          const bloodpressure = cells[`${year}-${name}-bloodpressure-${d}`]?.value || "";
          const weight = cells[`${year}-${name}-weight-${d}`]?.value || "";
          
          if (gym === "Yes" || movement || nutrition === "Yes" || sleep || bloodsugar || bloodpressure || weight) {
              const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              csv += `${activeUser},${dateStr},${gym},${movement},${nutrition},${sleep},${bloodsugar},${bloodpressure},${weight}\n`;
          }
        }
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeUser}_fitness_data_export.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [cells, activeUser]);

  const saveToDatabase = useCallback(async () => {
    try {
      const API_URL = import.meta.env.PROD ? '/api/data' : 'http://localhost:3000/api/data';
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUser, cells, sleepGoal, movementGoal })
      });
      if (response.ok) {
        setDbToast(true);
        setTimeout(() => setDbToast(false), 2500);
        if (activeUser) {
           setDbData(prev => {
              const nd = { ...prev };
              if (!nd.userData) nd.userData = {};
              nd.userData[activeUser] = { cells, sleepGoal, movementGoal };
              return nd;
           });
        }
      }
    } catch (error) {
      console.error("Error saving to database:", error);
    }
  }, [activeUser, cells, sleepGoal, movementGoal]);

  const toggle = useCallback((year, month, key, day) => {
    const id = `${year}-${month}-${key}-${day}`;
    if (editing === id) return;
    setCells(prev => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }));
  }, [editing]);

  const startEdit = useCallback((year, month, key, day, e, isHealth = false) => {
    e.stopPropagation();
    setEditing(`${year}-${month}-${key}-${day}`);
    const ref = isHealth ? healthInputRef : inputRef;
    setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0);
  }, []);

  const commitEdit = useCallback((year, month, key, day, val, isHealth = false) => {
    const id = `${year}-${month}-${key}-${day}`;
    const trimmed = String(val).trim();
    if (isHealth) {
      setCells(prev => ({ ...prev, [id]: { value: trimmed } }));
    } else if (NUMERIC_KEYS.includes(key)) {
      const n = parseFloat(trimmed);
      const maxVal = key === "sleep" ? 24 : 200;
      const valid = !isNaN(n) && n > 0 && n <= maxVal;
      setCells(prev => ({ ...prev, [id]: { value: valid ? String(n) : "", checked: valid } }));
    } else {
      setCells(prev => ({ ...prev, [id]: { ...prev[id], value: trimmed, checked: trimmed !== "" || prev[id].checked } }));
    }
    setEditing(null);
  }, []);

  const globalStreaks = useMemo(() =>
    Object.fromEntries(CATEGORIES.map(({ key }) => [key, computeGlobalStreak(cells, key)])),
    [cells]
  );

  const sleepStats = useCallback((year, name, days) => {
    const vals = Array.from({ length: days }, (_, i) => i + 1)
      .map(d => parseFloat(cells[`${year}-${name}-sleep-${d}`]?.value)).filter(h => !isNaN(h) && h > 0);
    return {
      count: vals.length,
      avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null,
      missedGoal: vals.filter(h => h < sleepGoal).length,
    };
  }, [cells, sleepGoal]);

  const movementStats = useCallback((year, name, days) => {
    const vals = Array.from({ length: days }, (_, i) => i + 1)
      .map(d => parseFloat(cells[`${year}-${name}-movement-${d}`]?.value)).filter(k => !isNaN(k) && k > 0);
    return {
      count: vals.length,
      total: vals.length ? vals.reduce((a, b) => a + b, 0).toFixed(1) : null,
      avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null,
      missedGoal: vals.filter(k => k < movementGoal).length,
    };
  }, [cells, movementGoal]);

  const monthsInfo = getMonthInfo(activeYear);

  const yearTotal = monthsInfo.reduce((sum, { name, days }) =>
    sum + CATEGORIES.reduce((s2, { key }) =>
      s2 + Array.from({ length: days }, (_, i) => i + 1)
          .filter(d => isCellDone(cells[`${activeYear}-${name}-${key}-${d}`], key)).length, 0), 0);
  const yearPossible = monthsInfo.reduce((s, { days }) => s + days * CATEGORIES.length, 0);
  const yearPct = Math.round((yearTotal / yearPossible) * 100);

  const streakEmoji = (n) => n >= 14 ? "🔥🔥" : n >= 7 ? "🔥" : n >= 3 ? "✦" : "";

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#fdf6ec",
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 31px,#e8dfd0 31px,#e8dfd0 32px)",
        fontFamily: "'Patrick Hand', cursive",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Fredoka+One&display=swap');
          * { box-sizing: border-box; }
          .welcome-card { background: rgba(255,255,255,0.75); backdrop-filter: blur(12px); padding: 45px 40px; border-radius: 24px; box-shadow: 0 12px 40px rgba(201, 79, 30, 0.12); border: 2px solid rgba(232, 223, 208, 0.9); text-align: center; max-width: 420px; width: 100%; animation: floatIn 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
          @keyframes floatIn { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
          .welcome-title { font-family: 'Fredoka One', cursive; font-size: 2.3rem; color: #c94f1e; text-shadow: 2px 2px 0 #f9c48a; margin: 0 0 4px; line-height: 1.1; }
          .welcome-sub { font-family: 'Fredoka One', cursive; font-size: 0.95rem; color: #7a5c3a; letter-spacing: 3px; margin: 0 0 35px; text-transform: uppercase; }
          .welcome-select { width: 100%; font-family: 'Fredoka One', cursive; font-size: 1.15rem; padding: 14px 20px; border-radius: 14px; border: 2px solid #d5c9b8; background: #fffaf4; color: #7a5c3a; outline: none; cursor: pointer; box-shadow: inset 0 2px 6px rgba(122, 92, 58, 0.05); margin-bottom: 28px; transition: border-color 0.2s, box-shadow 0.2s; text-align: center; }
          .welcome-select:hover, .welcome-select:focus { border-color: #e8623a; box-shadow: 0 0 0 4px rgba(232, 98, 58, 0.1); }
          .welcome-input { width: 100%; font-family: 'Patrick Hand', cursive; font-size: 1.15rem; padding: 12px 20px; border-radius: 14px; border: 2px solid #d5c9b8; background: #fffaf4; color: #7a5c3a; outline: none; box-shadow: inset 0 2px 6px rgba(122, 92, 58, 0.05); margin-bottom: 4px; transition: border-color 0.2s, box-shadow 0.2s; text-align: center; }
          .welcome-input:focus { border-color: #e8623a; box-shadow: 0 0 0 4px rgba(232, 98, 58, 0.1); }
          .error-text { color: #e05050; font-family: 'Patrick Hand', cursive; font-size: 0.95rem; min-height: 20px; margin-bottom: 20px; }
          .welcome-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: 'Fredoka One', cursive; font-size: 1.2rem; padding: 16px; border-radius: 16px; border: none; background: linear-gradient(135deg, #e8623a, #c94f1e); color: #fff; cursor: pointer; box-shadow: 0 6px 20px rgba(232, 98, 58, 0.3); transition: transform 0.2s, box-shadow 0.2s; }
          .welcome-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(232, 98, 58, 0.4); }
          .welcome-btn:active:not(:disabled) { transform: translateY(1px); }
        `}</style>
        <div className="welcome-card">
          <h1 className="welcome-title">✦ Welcome ✦</h1>
          <p className="welcome-sub">Select your Tracking Profile</p>
          
          <select 
            className="welcome-select"
            style={{ marginBottom: "15px" }}
            value={activeUser}
            onChange={(e) => { handleUserChange(e); setLoginError(""); setPasswordInput(""); }}
            disabled={usersList.length === 0}
          >
            {usersList.length === 0 && <option value="">Loading users...</option>}
            {usersList.map(u => <option key={u} value={u}>👤 {u}</option>)}
          </select>

          {usersList.length > 0 && (
            <>
              <input 
                type="password"
                className="welcome-input"
                placeholder="Enter Password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setLoginError(""); }}
                onKeyDown={(e) => { 
                  if (e.key === 'Enter') {
                    if (passwordInput === activeUser) { setIsAuthenticated(true); setLoginError(""); setPasswordInput(""); }
                    else { setLoginError("Incorrect password"); }
                  }
                }}
              />
              <div className="error-text">{loginError}</div>
            </>
          )}

          <button 
            className="welcome-btn"
            onClick={() => {
              if (passwordInput === activeUser) { setIsAuthenticated(true); setLoginError(""); setPasswordInput(""); }
              else { setLoginError("Incorrect password"); }
            }}
            disabled={usersList.length === 0}
            style={{ opacity: usersList.length === 0 ? 0.6 : 1, cursor: usersList.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            🚀 Enter Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fdf6ec",
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 31px,#e8dfd0 31px,#e8dfd0 32px)",
      fontFamily: "'Patrick Hand', cursive",
      padding: "20px 12px 48px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; }
        .bn-title { font-family:'Fredoka One',cursive; font-size:clamp(1.8rem,5vw,3rem); color:#c94f1e; text-shadow:3px 3px 0 #f9c48a; text-align:center; margin:0 0 2px; text-transform:uppercase; }
        .bn-sub { font-family:'Fredoka One',cursive; font-size:clamp(0.9rem,2.5vw,1.3rem); color:#7a5c3a; letter-spacing:4px; text-align:center; margin:0 0 14px; }
        .streak-banner { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px; }
        .streak-chip { display:flex; align-items:center; gap:5px; font-family:'Patrick Hand',cursive; font-size:0.78rem; padding:4px 10px; border-radius:16px; border:1.5px solid; transition:transform 0.15s; }
        .streak-chip:hover { transform:scale(1.05); }
        .streak-num { font-family:'Fredoka One',cursive; font-size:1rem; }
        .year-tabs { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px; }
        .year-tab { font-family:'Fredoka One',cursive; font-size:0.95rem; padding:5px 16px; border-radius:20px; border:2px solid #d5c9b8; background:#fffaf4; color:#7a5c3a; cursor:pointer; transition:all 0.15s; }
        .year-tab:hover { background:#fde8d8; border-color:#e8623a; }
        .year-tab.active { background:#e8623a; color:#fff; border-color:#c94f1e; box-shadow:0 3px 10px #e8623a44; }
        .month-tabs { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-bottom:14px; }
        .month-tab { font-family:'Fredoka One',cursive; font-size:0.85rem; padding:5px 14px; border-radius:20px; border:2px solid #d5c9b8; background:#fffaf4; color:#7a5c3a; cursor:pointer; transition:all 0.15s; position:relative; }
        .month-tab:hover { background:#fde8d8; border-color:#e8623a; }
        .month-tab.active { background:#e8623a; color:#fff; border-color:#c94f1e; box-shadow:0 3px 10px #e8623a44; }
        .month-tab .pct-badge { font-family:'Patrick Hand',cursive; font-size:0.6rem; position:absolute; top:-6px; right:-4px; background:#f9c48a; color:#7a3a10; border-radius:8px; padding:1px 4px; line-height:1; }
        .legends-row { display:flex; flex-wrap:wrap; gap:14px; justify-content:center; margin-bottom:10px; align-items:center; }
        .legend-group { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .legend-label { font-family:'Patrick Hand',cursive; font-size:0.7rem; color:#9a7a5a; }
        .legend-item { display:flex; align-items:center; gap:3px; font-family:'Patrick Hand',cursive; font-size:0.68rem; color:#7a5c3a; }
        .legend-dot { width:11px; height:11px; border-radius:3px; display:inline-block; }
        .goal-pills-row { display:flex; gap:8px; justify-content:center; margin-bottom:12px; flex-wrap:wrap; }
        .goal-pill { display:flex; align-items:center; gap:5px; font-family:'Patrick Hand',cursive; font-size:0.76rem; border:1.5px solid; border-radius:14px; padding:3px 10px; cursor:pointer; transition:filter 0.15s; }
        .goal-pill:hover { filter:brightness(0.95); }
        .goal-input { width:36px; border:none; background:transparent; font-family:'Fredoka One',cursive; font-size:0.82rem; text-align:center; outline:none; }
        .miss-badge { display:inline-block; background:#e05050; color:#fff; border-radius:8px; padding:1px 6px; font-size:0.62rem; font-family:'Patrick Hand',cursive; margin-left:4px; }
        .table-wrap { overflow-x:auto; border-radius:12px; box-shadow:0 4px 24px #c94f1e22; margin:0 auto; max-width:1060px; }
        .tracker-table { border-collapse:collapse; background:rgba(255,255,255,0.65); width:100%; }
        .tracker-table th, .tracker-table td { border:1px solid #d5c9b8; text-align:center; }
        .day-th { font-family:'Fredoka One',cursive; font-size:0.75rem; color:#b07840; padding:4px 2px 2px; width:27px; min-width:22px; background:#fff8ee; }
        .dow-th { font-size:0.55rem; color:#cbbfa8; font-family:'Patrick Hand',cursive; line-height:1; }
        .month-th { font-family:'Fredoka One',cursive; font-size:1rem; color:#c94f1e; padding:2px 10px; background:#fff4e6; border-right:2px solid #e8dfd0; white-space:nowrap; }
        .cat-td { font-family:'Patrick Hand',cursive; font-size:0.76rem; padding:0 6px; text-align:left; white-space:nowrap; background:#fffaf4; min-width:98px; }
        .streak-inline { font-family:'Fredoka One',cursive; font-size:0.68rem; margin-left:3px; opacity:0.9; }
        .tracker-cell { width:27px; min-width:22px; height:27px; cursor:pointer; padding:0; position:relative; transition:background 0.1s, filter 0.1s; }
        .numeric-row .tracker-cell { height:30px; cursor:text; }
        .tracker-cell.weekend-empty { background:#fdf0e0; }
        .tracker-cell:hover { filter:brightness(0.88); }
        .tracker-cell.missed-goal { box-shadow:inset 0 0 0 2px #e05050; }
        .cell-inner { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:0.58rem; font-family:'Patrick Hand',cursive; user-select:none; pointer-events:none; }
        .numeric-row .cell-inner { font-size:0.64rem; font-weight:bold; }
        .cell-input { width:25px; height:26px; border:none; background:transparent; text-align:center; font-size:0.64rem; font-family:'Patrick Hand',cursive; outline:none; padding:0; pointer-events:all; color:#2a1a0a; }
        .cell-input[type=number]::-webkit-outer-spin-button,.cell-input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
        .cell-input[type=number] { -moz-appearance:textfield; }
        .done-td { font-family:'Fredoka One',cursive; font-size:0.76rem; background:#fffaf4; padding:0 5px; white-space:nowrap; }
        .summary-tr td { font-family:'Patrick Hand',cursive; font-size:0.62rem; color:#9a7a5a; background:#fffaf4; height:18px; padding:0 2px; }
        .month-stats { display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
        .month-stat-chip { font-family:'Patrick Hand',cursive; font-size:0.76rem; padding:3px 10px; border-radius:12px; border:1.5px solid; white-space:nowrap; }

        .health-section-title { font-family:'Fredoka One',cursive; font-size:1.1rem; color:#7a5c3a; text-align:center; margin:28px 0 10px; display:flex; align-items:center; justify-content:center; gap:10px; }
        .health-section-title::before, .health-section-title::after { content:''; flex:1; max-width:120px; height:1.5px; background:#d5c9b8; display:block; }
        .health-table-wrap { overflow-x:auto; border-radius:12px; box-shadow:0 4px 20px #7a5c3a18; margin:0 auto; max-width:1060px; }
        .health-table { border-collapse:collapse; background:rgba(255,255,255,0.7); width:100%; }
        .health-table th, .health-table td { border:1px solid #d5c9b8; text-align:center; }
        .health-month-th { font-family:'Fredoka One',cursive; font-size:1rem; color:#c94f1e; padding:2px 10px; background:#fff4e6; border-right:2px solid #e8dfd0; white-space:nowrap; vertical-align:middle; }
        .health-cat-td { font-family:'Patrick Hand',cursive; font-size:0.76rem; padding:0 8px; text-align:left; white-space:nowrap; background:#fffaf4; min-width:110px; }
        .health-unit { font-size:0.58rem; opacity:0.65; margin-left:2px; }
        .health-cell { width:27px; min-width:22px; height:34px; cursor:text; padding:0; position:relative; transition:background 0.1s; }
        .health-cell:hover { background:#f5efe6 !important; }
        .health-cell.weekend-h { background:#fdf6ee; }
        .health-cell-inner { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-family:'Patrick Hand',cursive; font-weight:bold; user-select:none; pointer-events:none; line-height:1.1; }
        .health-input { width:26px; height:32px; border:none; background:transparent; text-align:center; font-size:0.6rem; font-family:'Patrick Hand',cursive; outline:none; padding:0; pointer-events:all; color:#2a1a0a; }

        .year-bar-wrap { max-width:1060px; margin:24px auto 0; display:flex; align-items:center; gap:12px; }
        .year-bar-bg { flex:1; height:20px; background:#ede0ce; border-radius:10px; overflow:hidden; border:1.5px solid #d5c9b8; }
        .year-bar-fill { height:100%; background:linear-gradient(90deg,#f9c48a,#e8623a); border-radius:10px; transition:width 0.5s cubic-bezier(.4,2,.6,1); }
        .year-bar-label { font-family:'Fredoka One',cursive; font-size:1rem; color:#c94f1e; min-width:48px; text-align:right; }
        .tip { font-family:'Patrick Hand',cursive; font-size:0.73rem; color:#b09070; text-align:center; margin-top:10px; line-height:1.7; }
      `}</style>

      <h1 className="bn-title">✦ HEALTH & FITNESS TRACKER ✦</h1>
      <p className="bn-sub">DAILY HABIT TRACKER</p>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <button 
          onClick={() => { setIsAuthenticated(false); setPasswordInput(""); setLoginError(""); }}
          style={{
            display: "flex", alignItems: "center", gap: "7px", fontFamily: "'Fredoka One',cursive",
            fontSize: "0.95rem", padding: "9px 16px", borderRadius: "14px", border: "2px solid #d5c9b8",
            background: "#fffaf4", color: "#7a5c3a", cursor: "pointer", boxShadow: "0 2px 8px #7a5c3a10",
            transition: "all 0.15s"
          }}
          title="Switch User Profile"
        >
          👤 {activeUser} (Switch)
        </button>
        <button 
          onClick={saveToDatabase}
          style={{
            display: "flex", alignItems: "center", gap: "7px", fontFamily: "'Fredoka One',cursive",
            fontSize: "0.95rem", padding: "10px 22px", borderRadius: "14px", border: "none",
            background: "#3a7aaa", color: "#fff", cursor: "pointer", boxShadow: "0 3px 12px #3a7aaa44",
            transition: "filter 0.15s"
          }}
        >
          💾 Save to DB
        </button>
        <button 
          onClick={exportCSV}
          style={{
            display: "flex", alignItems: "center", gap: "7px", fontFamily: "'Fredoka One',cursive",
            fontSize: "0.95rem", padding: "10px 22px", borderRadius: "14px", border: "1.5px solid #b8d4a0",
            background: "#e8f5d8", color: "#4a7a2a", cursor: "pointer", transition: "filter 0.15s"
          }}
        >
          ⬇️ Export CSV
        </button>
      </div>

      <div className="year-tabs">
        {YEARS.map(year => (
          <button key={year} className={`year-tab${activeYear === year ? " active" : ""}`}
            onClick={() => setActiveYear(year)}>
            {year}
          </button>
        ))}
      </div>

      <div className="streak-banner">
        {CATEGORIES.map(({ key, label }) => {
          const streak = globalStreaks[key];
          const c = CAT_COLORS[key];
          return (
            <div key={key} className="streak-chip" style={{ borderColor: c.bg, background: c.light, color: c.text }}>
              <span>{label.split(" ")[0]}</span>
              <span className="streak-num" style={{ color: c.bg }}>{streakEmoji(streak)} {streak}</span>
              <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>day{streak !== 1 ? "s" : ""}</span>
            </div>
          );
        })}
      </div>

      <div className="month-tabs">
        {monthsInfo.map(({ name, days }) => {
          const done = CATEGORIES.reduce((s, { key }) =>
            s + Array.from({ length: days }, (_, i) => i + 1)
                .filter(d => isCellDone(cells[`${activeYear}-${name}-${key}-${d}`], key)).length, 0);
          const pct = Math.round((done / (days * CATEGORIES.length)) * 100);
          return (
            <button key={name} className={`month-tab${activeMonth === name ? " active" : ""}`}
              onClick={() => setActiveMonth(name)}>
              {name.substring(0, 3)}
              {pct > 0 && <span className="pct-badge">{pct}%</span>}
            </button>
          );
        })}
      </div>

      <div className="legends-row">
        <div className="legend-group">
          <span className="legend-label">😴</span>
          {[["#e05050","<5h"],["#e8823a","5–6h"],["#d4a820","6–7h"],["#6aaa3a","7–8h"],["#3a8a5a","8h+"]].map(([c,l]) => (
            <div key={l} className="legend-item"><span className="legend-dot" style={{ background: c }} />{l}</div>
          ))}
        </div>
        <div style={{ width:1, height:18, background:"#d5c9b8" }} />
        <div className="legend-group">
          <span className="legend-label">🚶</span>
          {[["#b8d4a0","<2km"],["#6aaa3a","2–5km"],["#3a8a3a","5–8km"],["#2a6a5a","8–12km"],["#1a4a3a","12km+"]].map(([c,l]) => (
            <div key={l} className="legend-item"><span className="legend-dot" style={{ background: c }} />{l}</div>
          ))}
        </div>
      </div>

      <div className="goal-pills-row">
        <div className="goal-pill" style={{ background:"#ede8f8", borderColor:"#8a6aaa", color:"#6a4a8a" }}
          onClick={() => { setEditingGoal("sleep"); setTimeout(() => goalInputRef.current?.focus(), 0); }}>
          😴 Goal:
          {editingGoal === "sleep"
            ? <input ref={goalInputRef} className="goal-input" type="number" min="4" max="12" step="0.5" defaultValue={sleepGoal} style={{ color:"#6a4a8a" }}
                onBlur={e => { const v=parseFloat(e.target.value); if(!isNaN(v)&&v>0) setSleepGoal(v); setEditingGoal(null); }}
                onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditingGoal(null); }}
                onClick={e=>e.stopPropagation()} />
            : <strong style={{ fontFamily:"'Fredoka One',cursive" }}>{sleepGoal}h</strong>}
        </div>
        <div className="goal-pill" style={{ background:"#e8f5d8", borderColor:"#6aaa3a", color:"#4a7a2a" }}
          onClick={() => { setEditingGoal("movement"); setTimeout(() => goalInputRef.current?.focus(), 0); }}>
          🚶 Goal:
          {editingGoal === "movement"
            ? <input ref={goalInputRef} className="goal-input" type="number" min="1" max="100" step="0.5" defaultValue={movementGoal} style={{ color:"#4a7a2a" }}
                onBlur={e => { const v=parseFloat(e.target.value); if(!isNaN(v)&&v>0) setMovementGoal(v); setEditingGoal(null); }}
                onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditingGoal(null); }}
                onClick={e=>e.stopPropagation()} />
            : <strong style={{ fontFamily:"'Fredoka One',cursive" }}>{movementGoal}km</strong>}
        </div>
      </div>

      {monthsInfo.filter(m => m.name === activeMonth).map(({ name, days, startDow }) => {
        const dayArr = Array.from({ length: days }, (_, i) => i + 1);
        const sl = sleepStats(activeYear, name, days);
        const mv = movementStats(activeYear, name, days);

        return (
          <div key={name}>
            <div className="month-stats">
              {CATEGORIES.map(({ key, label }) => {
                const c = CAT_COLORS[key];
                const isSleep = key === "sleep";
                const isMovement = key === "movement";
                const done = dayArr.filter(d => isCellDone(cells[`${activeYear}-${name}-${key}-${d}`], key)).length;
                const monthBest = computeMonthBestStreak(cells, activeYear, name, days, key);
                let chipText;
                if (isSleep) {
                  chipText = sl.avg
                    ? <>{<strong>{sl.avg}h</strong>} avg · {sl.count}/{days} nights{sl.missedGoal > 0 && <span className="miss-badge">⚠ {sl.missedGoal} below {sleepGoal}h</span>}</>
                    : `0/${days} nights`;
                } else if (isMovement) {
                  chipText = mv.total
                    ? <>{<strong>{mv.total}km</strong>} total · avg {mv.avg}km · {mv.count}/{days} days{mv.missedGoal > 0 && <span className="miss-badge">⚠ {mv.missedGoal} below {movementGoal}km</span>}</>
                    : `0/${days} days`;
                } else {
                  chipText = <><strong>{done}/{days}</strong>{monthBest >= 3 ? ` · best ${monthBest}d` : ""}</>;
                }
                return (
                  <div key={key} className="month-stat-chip" style={{ color:c.text, borderColor:c.bg, background:c.light }}>
                    {label.split(" ")[0]}: {chipText}
                  </div>
                );
              })}
            </div>

            <div className="table-wrap">
              <table className="tracker-table">
                <thead>
                  <tr>
                    <th style={{ background:"#fff4e6", width:55, border:"1px solid #d5c9b8" }} />
                    <th style={{ background:"#fff4e6", width:100, border:"1px solid #d5c9b8" }} />
                    {dayArr.map(d => {
                      const dow = (startDow + d - 1) % 7;
                      return <th key={d} className="day-th">{d}<div className="dow-th">{DAY_NAMES[dow]}</div></th>;
                    })}
                    <th style={{ background:"#fff4e6", border:"1px solid #d5c9b8", fontSize:"0.6rem", color:"#b07840", fontFamily:"'Patrick Hand',cursive", width:48 }}>✓/tot</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map(({ key, label }, ci) => {
                    const c = CAT_COLORS[key];
                    const isNumeric = NUMERIC_KEYS.includes(key);
                    const isSleep = key === "sleep";
                    const isMovement = key === "movement";
                    const done = dayArr.filter(d => isCellDone(cells[`${activeYear}-${name}-${key}-${d}`], key)).length;
                    let running = 0;
                    const dayStreaks = dayArr.map(d => {
                      if (isCellDone(cells[`${activeYear}-${name}-${key}-${d}`], key)) running++;
                      else running = 0;
                      return running;
                    });
                    return (
                      <tr key={key} className={isNumeric ? "numeric-row" : ""}>
                        {ci === 0 && <td rowSpan={4} className="month-th" style={{ verticalAlign:"middle" }}>{name.substring(0,3)}</td>}
                        <td className="cat-td" style={{ color:c.text }}>
                          {label}
                        </td>
                        {dayArr.map((d, di) => {
                          const id = `${activeYear}-${name}-${key}-${d}`;
                          const cell = cells[id];
                          const dow = (startDow + d - 1) % 7;
                          const isWeekend = dow === 5 || dow === 6;
                          const isEdit = editing === id;
                          const streak = dayStreaks[di];
                          const showMilestone = !isNumeric && streak > 0 && streak % 7 === 0;
                          let bg, textColor, missedGoal = false, extraClass = "";
                          if (isSleep) {
                            const sc = sleepColor(cell?.value, sleepGoal);
                            bg=sc.bg; textColor=sc.text; missedGoal=sc.missedGoal;
                            if (missedGoal) extraClass=" missed-goal";
                          } else if (isMovement) {
                            const mc = movementColor(cell?.value, movementGoal);
                            bg=mc.bg; textColor=mc.text; missedGoal=mc.missedGoal;
                            if (missedGoal) extraClass=" missed-goal";
                          } else {
                            bg = cell?.checked ? c.bg : isWeekend ? "#fdf0e0" : "transparent";
                            textColor = cell?.checked ? "#fff" : "#bbb";
                            if (!cell?.checked && isWeekend) extraClass=" weekend-empty";
                          }
                          return (
                            <td key={d} className={`tracker-cell${extraClass}`} style={{ background:bg }}
                              onClick={isNumeric ? e=>startEdit(activeYear,name,key,d,e) : ()=>toggle(activeYear,name,key,d)}
                              onDoubleClick={!isNumeric ? e=>startEdit(activeYear,name,key,d,e) : undefined}
                              title={isSleep ? `${cell?.value?cell.value+"h"+(missedGoal?` ⚠ below ${sleepGoal}h`:" ✓"):"not logged"}`
                                : isMovement ? `${cell?.value?cell.value+"km"+(missedGoal?` ⚠ below ${movementGoal}km`:" ✓"):"not logged"}`
                                : `Day ${d}${streak>1?" · streak: "+streak:""}`}>
                              <div className="cell-inner" style={{ color:textColor }}>
                                {isEdit ? (
                                  <input ref={inputRef} className="cell-input" type="number"
                                    min="0" max={isSleep?"24":"500"} step={isSleep?"0.5":"0.1"}
                                    defaultValue={cell?.value}
                                    onBlur={e=>commitEdit(activeYear,name,key,d,e.target.value)}
                                    onKeyDown={e=>{ if(e.key==="Enter") { commitEdit(activeYear,name,key,d,e.target.value); setEditing(null); } if(e.key==="Escape") setEditing(null); }}
                                    onClick={e=>e.stopPropagation()} />
                                ) : isNumeric ? (cell?.value||"")
                                  : showMilestone ? <span style={{ fontSize:"0.52rem", fontWeight:"bold" }}>🔥{streak}</span>
                                  : (cell?.value||(cell?.checked?"✓":""))}
                              </div>
                            </td>
                          );
                        })}
                        <td className="done-td" style={{
                          color: isSleep?(sl.avg?CAT_COLORS.sleep.text:"#b07840"):isMovement?(mv.total?CAT_COLORS.movement.text:"#b07840"):(done===days?c.bg:"#b07840"),
                          fontSize: isNumeric?"0.66rem":"0.78rem",
                        }}>
                          {isSleep?(sl.avg?`${sl.avg}h`:"–"):isMovement?(mv.total?`${mv.total}k`:"–"):`${done}/${days}`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="summary-tr">
                    <td colSpan={2} style={{ textAlign:"right", paddingRight:6, fontStyle:"italic" }}>day total</td>
                    {dayArr.map(d => {
                      const n = ["gym","nutrition"].filter(k=>cells[`${activeYear}-${name}-${k}-${d}`]?.checked).length
                              + (cells[`${activeYear}-${name}-sleep-${d}`]?.value?1:0)
                              + (cells[`${activeYear}-${name}-movement-${d}`]?.value?1:0);
                      return (
                        <td key={d} style={{
                          background:n===4?"#fde8d8":n>0?"#fff4ec":"transparent",
                          color:n===4?"#c94f1e":"#9a7a5a", fontWeight:n===4?"bold":"normal",
                        }}>{n||""}</td>
                      );
                    })}
                    <td style={{ color:"#9a7a5a", fontSize:"0.6rem" }}>
                      {["gym","nutrition"].reduce((s,k)=>s+dayArr.filter(d=>cells[`${activeYear}-${name}-${k}-${d}`]?.checked).length,0)+sl.count+mv.count}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="health-section-title">🩺 Health Metrics — {name} {activeYear}</div>

            <div className="health-table-wrap">
              <table className="health-table">
                <thead>
                  <tr>
                    <th style={{ background:"#fff4e6", width:55, border:"1px solid #d5c9b8" }} />
                    <th style={{ background:"#fff4e6", width:120, border:"1px solid #d5c9b8" }} />
                    {dayArr.map(d => {
                      const dow = (startDow + d - 1) % 7;
                      return <th key={d} className="day-th">{d}<div className="dow-th">{DAY_NAMES[dow]}</div></th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {HEALTH_METRICS.map(({ key, label, unit, color, light, text }, hi) => (
                    <tr key={key}>
                      {hi === 0 && (
                        <td rowSpan={3} className="health-month-th">{name.substring(0,3)}</td>
                      )}
                      <td className="health-cat-td" style={{ color: text }}>
                        {label}
                        <span className="health-unit">{unit}</span>
                      </td>
                      {dayArr.map(d => {
                        const id = `${activeYear}-${name}-${key}-${d}`;
                        const val = cells[id]?.value || "";
                        const dow = (startDow + d - 1) % 7;
                        const isWeekend = dow === 5 || dow === 6;
                        const isEdit = editing === id;
                        const hasVal = val !== "";

                        return (
                          <td key={d}
                            className={`health-cell${isWeekend ? " weekend-h" : ""}${hasVal ? " has-value" : ""}`}
                            style={{ background: hasVal ? light : isWeekend ? "#fdf6ee" : "transparent" }}
                            onClick={e => startEdit(activeYear, name, key, d, e, true)}
                            title={`${label} · Day ${d}${val ? ": " + val + " " + unit : " — click to log"}`}>
                            <div className="health-cell-inner" style={{ color: hasVal ? text : "#cbbfa8" }}>
                              {isEdit ? (
                                <input
                                  ref={healthInputRef}
                                  className="health-input"
                                  type="text"
                                  defaultValue={val}
                                  onBlur={e => commitEdit(activeYear, name, key, d, e.target.value, true)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") { commitEdit(activeYear, name, key, d, e.target.value, true); setEditing(null); }
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                  onClick={e => e.stopPropagation()}
                                />
                              ) : (
                                val || ""
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="year-bar-wrap">
        <span style={{ fontFamily:"'Patrick Hand',cursive", fontSize:"0.82rem", color:"#7a5c3a", whiteSpace:"nowrap" }}>{activeYear} overall</span>
        <div className="year-bar-bg"><div className="year-bar-fill" style={{ width:`${yearPct}%` }} /></div>
        <span className="year-bar-label">{yearPct}%</span>
      </div>

      <p className="tip">
        🚶 Movement & 😴 Sleep: click → type value · missed goal = red border · 🎯 click goal pills to update targets<br/>
        🩺 Health metrics: click any cell → type your reading · blood pressure accepts 120/80 format
      </p>

      <div style={{
          position: "fixed", bottom: "clamp(20px, 5vh, 40px)", left: "50%", transform: "translateX(-50%)",
          background: "#3a2a1a", color: "#fff", fontFamily: "'Patrick Hand',cursive", fontSize: "0.85rem",
          padding: "10px 20px", borderRadius: "12px", zIndex: 200, opacity: dbToast ? 1 : 0,
          transition: "opacity 0.2s", pointerEvents: "none", whiteSpace: "nowrap"
      }}>
        ✅ Saved to Database!
      </div>
    </div>
  );
}
