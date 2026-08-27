/* Health Module - Body Composition & Exercise Tracking */
'use strict';
var Health = (function() {
  var BODY_KEY = 'assetbook.health.body';
  var EXER_KEY = 'assetbook.health.exercise';
  var tab = 'body'; // body | exercise
  var calYear, calMonth; // calendar state (0-indexed month)

  function loadBody() {
    try { return JSON.parse(localStorage.getItem(BODY_KEY)) || []; } catch(e) { return []; }
  }
  function saveBody(arr) { localStorage.setItem(BODY_KEY, JSON.stringify(arr)); }
  function loadExer() {
    try { return JSON.parse(localStorage.getItem(EXER_KEY)) || []; } catch(e) { return []; }
  }
  function saveExer(arr) { localStorage.setItem(EXER_KEY, JSON.stringify(arr)); }

  function esc(s) { return String(s||'').replace(/[&<>"]/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmtNum(n, d) { return n != null && n !== '' ? Number(n).toFixed(d == null ? 1 : d) : '-'; }
  function today() { return new Date().toISOString().substring(0, 10); }

  // ===== Body Composition =====
  var BODY_FIELDS = [
    { key: 'weight', label: '体重', unit: 'kg', dec: 1 },
    { key: 'bodyFat', label: '体脂率', unit: '%', dec: 1 },
    { key: 'muscle', label: '肌肉量', unit: 'kg', dec: 1 },
    { key: 'bmi', label: 'BMI', unit: '', dec: 1 },
    { key: 'bmr', label: '基础代谢', unit: 'kcal', dec: 0 },
    { key: 'visceralFat', label: '内脏脂肪', unit: '', dec: 1 },
    { key: 'water', label: '体水分', unit: 'kg', dec: 1 },
    { key: 'protein', label: '蛋白质', unit: 'kg', dec: 1 },
    { key: 'boneMass', label: '骨量', unit: 'kg', dec: 1 },
    { key: 'fatMass', label: '脂肪量', unit: 'kg', dec: 1 },
    { key: 'skeletalMuscle', label: '骨骼肌', unit: 'kg', dec: 1 }
  ];
  // Core fields shown in summary and form (others optional)
  var CORE_FIELDS = ['weight', 'bodyFat', 'muscle', 'bmi', 'bmr', 'visceralFat'];

  function renderBodyTab() {
    var records = loadBody().sort(function(a, b) { return b.date.localeCompare(a.date); });
    var html = '';

    // Latest summary card
    if (records.length) {
      var latest = records[0];
      html += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<span style="font-weight:600;font-size:15px">最新数据</span>' +
        '<span style="font-size:12px;color:var(--muted)">' + latest.date.substring(0, 10) + '</span></div>' +
        '<div class="summary-grid">';
      CORE_FIELDS.forEach(function(k) {
        var f = BODY_FIELDS.find(function(x) { return x.key === k; });
        var val = latest[k];
        var diff = '';
        if (records.length > 1) {
          var prev = records[1][k];
          if (val != null && prev != null && val !== '' && prev !== '') {
            var d = Number(val) - Number(prev);
            if (d !== 0) diff = '<span style="font-size:11px;font-weight:400;margin-left:4px;color:' +
              (d > 0 ? 'var(--up)' : 'var(--down)') + '">' + (d > 0 ? '+' : '') + d.toFixed(f.dec) + '</span>';
          }
        }
        html += '<div class="summary-card"><div class="label">' + f.label + '</div>' +
          '<div class="value">' + fmtNum(val, f.dec) + '<span style="font-size:11px;font-weight:400;color:var(--muted)">' + f.unit + '</span>' + diff + '</div></div>';
      });
      html += '</div></div>';
    }

    // History or empty state
    if (records.length) {
      html += '<div class="card" style="padding:0;overflow:hidden">' +
        '<div style="padding:10px 14px;border-bottom:1px solid var(--line);font-weight:600;font-size:14px">历史记录</div>';
      records.forEach(function(r, i) {
        html += '<div class="row health-rec" data-idx="' + i + '" style="padding:10px 14px;cursor:pointer">' +
          '<div class="grow"><b>' + r.date.substring(0, 10) + '</b><br>' +
          '<span class="muted small">体重 ' + fmtNum(r.weight) + 'kg · 体脂 ' + fmtNum(r.bodyFat) + '% · 肌肉 ' + fmtNum(r.muscle) + 'kg</span></div>' +
          '<span class="muted small">›</span></div>';
      });
      html += '</div>';
    } else if (!records.length) {
      html += '<div class="card muted center">还没有记录，点右下角 ＋ 添加</div>';
    }
    return html;
  }

  function buildBodyFormHtml(r, isEdit) {
    var html = '<form id="body-form"><div class="form-row"><label>日期</label>' +
      '<input name="date" type="date" required value="' + (r.date || today()) + '"></div>';
    html += '<div class="form-two-col">';
    CORE_FIELDS.forEach(function(k) {
      var f = BODY_FIELDS.find(function(x) { return x.key === k; });
      html += '<div class="form-row"><label>' + f.label + (f.unit ? ' (' + f.unit + ')' : '') + '</label>' +
        '<input name="' + k + '" type="number" step="0.1" value="' + (r[k] != null ? r[k] : '') + '"></div>';
    });
    html += '</div>';
    html += '<details style="margin:8px 0"><summary style="font-size:13px;color:var(--accent);cursor:pointer">更多指标</summary>' +
      '<div class="form-two-col" style="margin-top:8px">';
    BODY_FIELDS.forEach(function(f) {
      if (CORE_FIELDS.indexOf(f.key) >= 0) return;
      html += '<div class="form-row"><label>' + f.label + (f.unit ? ' (' + f.unit + ')' : '') + '</label>' +
        '<input name="' + f.key + '" type="number" step="0.1" value="' + (r[f.key] != null ? r[f.key] : '') + '"></div>';
    });
    html += '</div></details>';
    html += '<div class="btn-row">' +
      (isEdit ? '<button type="button" class="btn danger" id="bf-del">删除</button>' : '') +
      '<button type="button" class="btn" id="bf-cancel">取消</button>' +
      '<button type="submit" class="btn primary">保存</button></div></form>';
    return html;
  }

  function bindBodyForm(root, record) {
    var isEdit = !!record;
    root.querySelector('#bf-cancel').onclick = window._closeModal;
    if (isEdit) {
      root.querySelector('#bf-del').onclick = function() {
        if (!confirm('删除这条记录？')) return;
        var recs = loadBody();
        recs = recs.filter(function(x) { return x !== record; });
        saveBody(recs);
        window._closeModal();
        render();
      };
    }
    root.querySelector('#body-form').onsubmit = function(e) {
      e.preventDefault();
      var f = e.target;
      var obj = { date: f.date.value };
      BODY_FIELDS.forEach(function(field) {
        var v = parseFloat(f[field.key].value);
        if (!isNaN(v)) obj[field.key] = v;
      });
      if (!obj.date) { alert('请选择日期'); return; }
      var recs = loadBody();
      if (isEdit) {
        recs = recs.map(function(x) { return x === record ? obj : x; });
      } else {
        recs.push(obj);
      }
      saveBody(recs);
      window._closeModal();
      render();
    };
  }

  function openBodyForm(record, prefill) {
    var isEdit = !!record;
    var r = record || prefill || {};
    var html = '<h3>' + (isEdit ? '编辑体脂记录' : '记录体脂数据') + '</h3>' + buildBodyFormHtml(r, isEdit);
    var root = window._openModal(html);
    bindBodyForm(root, record);
  }

  function openBodyDetail(idx) {
    var records = loadBody().sort(function(a, b) { return b.date.localeCompare(a.date); });
    var r = records[idx];
    if (!r) return;
    var html = '<h3>' + r.date.substring(0, 10) + '</h3><div style="margin:10px 0">';
    BODY_FIELDS.forEach(function(f) {
      if (r[f.key] != null) {
        html += '<div class="dl-row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">' +
          '<span style="color:var(--muted)">' + f.label + '</span>' +
          '<span style="font-weight:600">' + fmtNum(r[f.key], f.dec) + ' ' + f.unit + '</span></div>';
      }
    });
    html += '</div><div class="btn-row">' +
      '<button class="btn" id="bd-close">关闭</button>' +
      '<button class="btn primary" id="bd-edit">编辑</button></div>';
    var root = window._openModal(html);
    root.querySelector('#bd-close').onclick = window._closeModal;
    root.querySelector('#bd-edit').onclick = function() {
      window._closeModal();
      setTimeout(function() { openBodyForm(r); }, 100);
    };
  }

  // ===== Exercise Calendar =====
  var EXER_TYPES = ['跑步', '游泳', '力量训练', '瑜伽', '网球', '骑行', '跳绳', 'HIIT', '散步', '其他'];

  function initCalendar() {
    var now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }

  function renderExerciseTab() {
    if (calYear == null) initCalendar();
    var exercises = loadExer();
    // Build date->exercises map
    var dateMap = {};
    exercises.forEach(function(e) {
      if (!dateMap[e.date]) dateMap[e.date] = [];
      dateMap[e.date].push(e);
    });

    var html = '';
    // Month summary
    var monthStr = calYear + '-' + String(calMonth + 1).padStart(2, '0');
    var monthExer = exercises.filter(function(e) { return e.date.startsWith(monthStr); });
    var totalMin = monthExer.reduce(function(s, e) { return s + (e.duration || 0); }, 0);
    var activeDays = {};
    monthExer.forEach(function(e) { activeDays[e.date] = true; });
    var dayCount = Object.keys(activeDays).length;

    html += '<div class="summary-grid" style="margin-bottom:12px">' +
      '<div class="summary-card"><div class="label">本月运动天数</div><div class="value">' + dayCount + '</div></div>' +
      '<div class="summary-card"><div class="label">总时长</div><div class="value">' + totalMin + '<span style="font-size:11px;font-weight:400;color:var(--muted)"> min</span></div></div></div>';

    // Calendar nav
    var mNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    html += '<div class="card" style="padding:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
      '<button class="icon-btn" id="cal-prev" style="font-size:18px">‹</button>' +
      '<span id="cal-title" style="font-weight:600;font-size:15px;cursor:pointer">' + calYear + '年 ' + mNames[calMonth] + ' ▾</span>' +
      '<button class="icon-btn" id="cal-next" style="font-size:18px">›</button></div>';

    // Calendar grid
    html += '<div class="cal-grid">';
    ['日','一','二','三','四','五','六'].forEach(function(d) {
      html += '<div class="cal-head">' + d + '</div>';
    });
    var firstDay = new Date(calYear, calMonth, 1).getDay();
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var todayStr = today();
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var ds = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var hasEx = dateMap[ds] && dateMap[ds].length > 0;
      var isToday = ds === todayStr;
      var cls = 'cal-cell' + (hasEx ? ' has-ex' : '') + (isToday ? ' today' : '');
      html += '<div class="' + cls + '" data-date="' + ds + '">' +
        '<span class="cal-day">' + d + '</span>' +
        (hasEx ? '<span class="cal-dot"></span>' : '') + '</div>';
    }
    html += '</div></div>';

    // Today's exercises
    var todayEx = dateMap[todayStr] || [];
    if (todayEx.length) {
      html += '<div style="margin-top:12px;font-weight:600;font-size:14px;margin-bottom:6px">今日运动</div>';
      todayEx.forEach(function(e) {
        html += '<div class="card" style="padding:10px 14px;margin-bottom:6px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span>' + esc(e.type) + '</span>' +
          '<span style="color:var(--accent);font-weight:600">' + (e.duration || 0) + ' min</span></div>' +
          (e.note ? '<div class="muted small" style="margin-top:4px">' + esc(e.note) + '</div>' : '') +
          '</div>';
      });
    }

    return html;
  }

  function openExerciseForm(dateStr) {
    var html = '<h3>记录运动</h3><form id="exer-form">' +
      '<div class="form-row"><label>日期</label>' +
      '<input name="date" type="date" required value="' + (dateStr || today()) + '"></div>' +
      '<div class="form-row"><label>运动类型</label>' +
      '<select name="type">' + EXER_TYPES.map(function(t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-row"><label>时长 (分钟)</label>' +
      '<input name="duration" type="number" min="1" required placeholder="30"></div>' +
      '<div class="form-row"><label>备注 (可选)</label>' +
      '<input name="note" placeholder=""></div>' +
      '<div class="btn-row"><button type="button" class="btn" id="ef-cancel">取消</button>' +
      '<button type="submit" class="btn primary">保存</button></div></form>';
    var root = window._openModal(html);
    root.querySelector('#ef-cancel').onclick = window._closeModal;
    root.querySelector('#exer-form').onsubmit = function(e) {
      e.preventDefault();
      var f = e.target;
      var obj = {
        date: f.date.value,
        type: f.type.value,
        duration: parseInt(f.duration.value) || 0,
        note: f.note.value.trim()
      };
      if (!obj.date || !obj.duration) { alert('请填写日期和时长'); return; }
      var recs = loadExer();
      recs.push(obj);
      saveExer(recs);
      window._closeModal();
      render();
    };
  }

  // ===== Tabbed Body Modal (手动输入 / 拍照识别) =====
  var OCR_KEY_DEFAULT = 'sk-ws-H.EPRRRHI.HlbR.MEYCIQDrYAyIGWpKBXwWUf0Hi3BLICroawr8-HYbqM4ErV0odAIhAMsVp6Hr07NR1hswIIgUqPhViBiJFgAy2o0RmjayrYpg';
  var OCR_PROMPT = '请从这张体脂秤/体成分报告中提取以下数据，以JSON格式返回（只返回JSON，不要其他文字）。' +
    '字段：weight(体重kg), bodyFat(体脂率%), muscle(肌肉量kg), bmi(BMI), bmr(基础代谢kcal), visceralFat(内脏脂肪指数), ' +
    'water(体水分kg), protein(蛋白质kg), boneMass(骨量kg), fatMass(脂肪量kg), skeletalMuscle(骨骼肌kg), date(报告日期YYYY-MM-DD)。' +
    '如果某个字段在图中找不到，设为null。数字用number类型，不要用字符串。';

  function pickImage(cb) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function() {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() { cb(reader.result); };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function callQwenVl(key, imageBase64, cb) {
    var toast = document.createElement('div');
    toast.textContent = '正在识别…';
    toast.style.cssText = 'position:fixed;bottom:calc(90px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:rgba(0,0,0,.78);color:#fff;padding:9px 18px;border-radius:20px;font-size:14px;z-index:300;';
    document.body.appendChild(toast);
    fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imageBase64 } },
          { type: 'text', text: OCR_PROMPT }
        ]}]
      })
    }).then(function(res) {
      if (!res.ok) return res.text().then(function(t) { throw new Error('API ' + res.status + ': ' + t); });
      return res.json();
    }).then(function(json) {
      toast.remove();
      var text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (!text) throw new Error('返回内容为空');
      var match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('无法解析返回数据');
      cb(null, JSON.parse(match[0]));
    }).catch(function(e) {
      toast.remove();
      cb(e.message || String(e));
    });
  }

  function openBodyModal() {
    var html = '<div class="modal-tabs">' +
      '<button class="modal-tab active" data-mtab="form">手动输入</button>' +
      '<button class="modal-tab" data-mtab="ocr">拍照识别</button></div>' +
      '<div id="mtab-form" style="min-height:320px">' + buildBodyFormHtml({}, false) + '</div>' +
      '<div id="mtab-ocr" class="hidden" style="min-height:320px">' +
      '<div style="text-align:center;padding:24px 0">' +
      '<div style="color:var(--muted);font-size:14px;margin-bottom:16px">上传体脂秤报告照片，自动识别数据</div>' +
      '<button class="btn primary" id="btn-ocr-pick">选择图片</button></div></div>';
    var root = window._openModal(html);

    // Tab switching
    root.querySelectorAll('.modal-tab').forEach(function(t) {
      t.onclick = function() {
        root.querySelectorAll('.modal-tab').forEach(function(x) { x.classList.remove('active'); });
        t.classList.add('active');
        var isForm = t.dataset.mtab === 'form';
        root.querySelector('#mtab-form').classList.toggle('hidden', !isForm);
        root.querySelector('#mtab-ocr').classList.toggle('hidden', isForm);
      };
    });

    // Bind form in the form tab
    bindBodyForm(root, null);

    // OCR pick button
    root.querySelector('#btn-ocr-pick').onclick = function() {
      var key = (window._getAiKey && window._getAiKey()) || OCR_KEY_DEFAULT;
      pickImage(function(base64) {
        callQwenVl(key, base64, function(err, data) {
          if (err) { alert('识别失败：' + err); return; }
          // Switch to form tab with prefilled data
          var prefill = { date: data.date || today() };
          BODY_FIELDS.forEach(function(f) {
            if (data[f.key] != null && data[f.key] !== '' && !isNaN(data[f.key])) {
              prefill[f.key] = Number(data[f.key]);
            }
          });
          root.querySelector('#mtab-form').innerHTML = buildBodyFormHtml(prefill, false);
          bindBodyForm(root, null);
          // Switch tab visually
          root.querySelectorAll('.modal-tab').forEach(function(x) { x.classList.remove('active'); });
          root.querySelector('[data-mtab="form"]').classList.add('active');
          root.querySelector('#mtab-form').classList.remove('hidden');
          root.querySelector('#mtab-ocr').classList.add('hidden');
        });
      });
    };
  }

  // ===== Period Calendar =====
  var PER_KEY = 'assetbook.health.periods';
  var pCalYear, pCalMonth;

  function loadPeriodData() {
    try { return JSON.parse(localStorage.getItem(PER_KEY)) || { records: [], cycleLength: 28, periodLength: 5 }; }
    catch(e) { return { records: [], cycleLength: 28, periodLength: 5 }; }
  }
  function savePeriodData(d) { localStorage.setItem(PER_KEY, JSON.stringify(d)); }

  function getAvgCycleLength(records) {
    if (records.length < 2) return null;
    var sorted = records.slice().sort(function(a, b) { return a.start.localeCompare(b.start); });
    var total = 0, count = 0;
    for (var i = 1; i < sorted.length; i++) {
      var diff = Math.round((new Date(sorted[i].start) - new Date(sorted[i - 1].start)) / 86400000);
      if (diff > 15 && diff < 60) { total += diff; count++; }
    }
    return count > 0 ? Math.round(total / count) : null;
  }

  function getPeriodDaySet(records) {
    var s = {};
    records.forEach(function(r) {
      if (!r.start) return;
      var end = r.end || r.start;
      var d = new Date(r.start + 'T00:00:00');
      var e = new Date(end + 'T00:00:00');
      for (var t = new Date(d); t <= e; t.setDate(t.getDate() + 1)) {
        s[t.toISOString().substring(0, 10)] = true;
      }
    });
    return s;
  }

  function predictPeriodInfo(records, cycleLen) {
    if (!records.length) return { nextStart: null, fertileDays: {}, ovulationDay: null };
    var sorted = records.slice().sort(function(a, b) { return b.start.localeCompare(a.start); });
    var lastStart = new Date(sorted[0].start + 'T00:00:00');
    var avg = getAvgCycleLength(records) || cycleLen;
    var nextStart = new Date(lastStart);
    nextStart.setDate(nextStart.getDate() + avg);
    var todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    while (nextStart <= todayDate) nextStart.setDate(nextStart.getDate() + avg);
    var nextStr = nextStart.toISOString().substring(0, 10);
    var ovDate = new Date(nextStart); ovDate.setDate(ovDate.getDate() - 14);
    var ovStr = ovDate.toISOString().substring(0, 10);
    var fertileDays = {};
    for (var i = -5; i <= 1; i++) {
      var fd = new Date(ovDate); fd.setDate(fd.getDate() + i);
      fertileDays[fd.toISOString().substring(0, 10)] = true;
    }
    return { nextStart: nextStr, fertileDays: fertileDays, ovulationDay: ovStr };
  }

  function renderPeriodTab() {
    if (pCalYear == null) { var now = new Date(); pCalYear = now.getFullYear(); pCalMonth = now.getMonth(); }
    var data = loadPeriodData();
    var records = data.records;
    var cycleLen = data.cycleLength || 28;
    var periodLen = data.periodLength || 5;
    var periodDays = getPeriodDaySet(records);
    var pred = predictPeriodInfo(records, cycleLen);
    var todayStr = today();
    var html = '';

    // Overview card
    var sorted = records.slice().sort(function(a, b) { return b.start.localeCompare(a.start); });
    if (sorted.length > 0) {
      var lastStart = new Date(sorted[0].start + 'T00:00:00');
      var todayDate = new Date(todayStr + 'T00:00:00');
      var cycleDay = Math.round((todayDate - lastStart) / 86400000) + 1;
      var isOnPeriod = !!periodDays[todayStr];
      var statusText = isOnPeriod ? '经期中' : '第 ' + cycleDay + ' 天';
      var nextText = pred.nextStart ? '预计 ' + pred.nextStart.substring(5).replace('-', '/') + ' 来' : '记录更多数据以预测';
      html += '<div class="period-overview">' +
        '<div class="po-label">当前状态</div>' +
        '<div class="po-value">' + statusText + '</div>' +
        '<div class="po-sub">' + nextText + ' · 周期 ' + cycleLen + ' 天 · 经期 ' + periodLen + ' 天</div></div>';
    } else {
      html += '<div class="period-overview">' +
        '<div class="po-label">还没有记录</div>' +
        '<div class="po-sub">点击下方日历上的日期，记录经期开始日</div></div>';
    }

    // Calendar
    var mNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    html += '<div class="card" style="padding:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
      '<button class="icon-btn" id="pc-prev" style="font-size:18px">‹</button>' +
      '<span id="pc-title" style="font-weight:600;font-size:15px;cursor:pointer">' + pCalYear + '年 ' + mNames[pCalMonth] + ' ▾</span>' +
      '<button class="icon-btn" id="pc-next" style="font-size:18px">›</button></div>';

    html += '<div class="cal-grid">';
    ['日','一','二','三','四','五','六'].forEach(function(d) { html += '<div class="cal-head">' + d + '</div>'; });
    var firstDay = new Date(pCalYear, pCalMonth, 1).getDay();
    var daysInMonth = new Date(pCalYear, pCalMonth + 1, 0).getDate();
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

    // Predicted period days for this month
    var predDays = {};
    if (pred.nextStart) {
      var ps = new Date(pred.nextStart + 'T00:00:00');
      for (var pi = 0; pi < periodLen; pi++) {
        var pd = new Date(ps); pd.setDate(pd.getDate() + pi);
        predDays[pd.toISOString().substring(0, 10)] = true;
      }
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var ds = pCalYear + '-' + String(pCalMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isToday = ds === todayStr;
      var isPeriod = !!periodDays[ds];
      var isPred = !isPeriod && !!predDays[ds];
      var isFertile = !isPeriod && !isPred && !!pred.fertileDays[ds];
      var isOv = ds === pred.ovulationDay && !isPeriod;
      var cls = 'cal-cell';
      if (isPeriod) cls += ' period-day';
      else if (isPred) cls += ' period-predicted';
      else if (isFertile) cls += ' period-fertile';
      if (isOv) cls += ' period-ovulation';
      if (isToday) cls += ' today';
      html += '<div class="' + cls + '" data-date="' + ds + '"><span class="cal-day">' + d + '</span></div>';
    }
    html += '</div>';

    // Legend
    html += '<div class="period-legend">' +
      '<span><span class="period-legend-dot" style="background:#fecdd3"></span>经期</span>' +
      '<span><span class="period-legend-dot" style="background:#fff1f2"></span>预测</span>' +
      '<span><span class="period-legend-dot" style="background:#ecfccb"></span>易孕期</span>' +
      '</div></div>';

    // History
    if (sorted.length > 0) {
      html += '<div class="card" style="padding:0;overflow:hidden">' +
        '<div style="padding:10px 14px;border-bottom:1px solid var(--line);font-weight:600;font-size:14px">' +
        '经期记录 <button id="pc-settings" style="float:right;border:0;background:none;color:var(--accent);font-size:13px;cursor:pointer">设置</button></div>';
      sorted.slice(0, 12).forEach(function(r, i) {
        var endDate = r.end || r.start;
        var dur = Math.round((new Date(endDate) - new Date(r.start)) / 86400000) + 1;
        html += '<div class="period-history-item" data-pidx="' + i + '">' +
          '<div><b>' + r.start + '</b> <span class="muted small">~ ' + endDate + ' (' + dur + '天)</span></div>' +
          '<span class="muted small">›</span></div>';
      });
      html += '</div>';
    }

    return html;
  }

  function openPeriodDaySheet(dateStr) {
    var data = loadPeriodData();
    var records = data.records;
    var periodDays = getPeriodDaySet(records);
    var isPeriod = !!periodDays[dateStr];
    var cycleLen = data.cycleLength || 28;
    var periodLen = data.periodLength || 5;

    if (isPeriod) {
      // Find which record(s) contain this date
      var matching = [];
      records.forEach(function(r, idx) {
        if (!r.start) return;
        var end = r.end || r.start;
        if (dateStr >= r.start && dateStr <= end) matching.push({ record: r, idx: idx });
      });
      var html = '<h3>' + dateStr + '</h3><div style="margin:8px 0">';
      matching.forEach(function(m) {
        var r = m.record;
        html += '<div class="card" style="margin-bottom:8px;padding:10px">' +
          '<div>经期：' + r.start + ' ~ ' + (r.end || r.start) + '</div>' +
          '<div class="btn-row" style="margin-top:6px">' +
          '<button class="btn small" data-act="edit" data-ridx="' + m.idx + '">编辑</button>' +
          '<button class="btn small danger" data-act="del" data-ridx="' + m.idx + '">删除</button></div></div>';
      });
      html += '</div><div class="btn-row"><button class="btn" id="pds-close">关闭</button></div>';
      var root = window._openModal(html);
      root.querySelector('#pds-close').onclick = window._closeModal;
      root.querySelectorAll('[data-act="del"]').forEach(function(btn) {
        btn.onclick = function() {
          if (!confirm('删除这条经期记录？')) return;
          var idx = parseInt(btn.dataset.ridx, 10);
          data.records.splice(idx, 1);
          savePeriodData(data);
          window._closeModal();
          refreshPeriod();
        };
      });
      root.querySelectorAll('[data-act="edit"]').forEach(function(btn) {
        btn.onclick = function() {
          var idx = parseInt(btn.dataset.ridx, 10);
          window._closeModal();
          setTimeout(function() { openPeriodEditForm(data.records[idx], idx); }, 100);
        };
      });
    } else {
      // Quick add: mark as period start
      var defaultEnd = new Date(dateStr + 'T00:00:00');
      defaultEnd.setDate(defaultEnd.getDate() + periodLen - 1);
      var defaultEndStr = defaultEnd.toISOString().substring(0, 10);
      var html = '<h3>记录经期</h3>' +
        '<form id="period-quick-form">' +
        '<div class="form-two-col">' +
        '<div class="form-row"><label>开始日期</label>' +
        '<input name="start" type="date" required value="' + dateStr + '"></div>' +
        '<div class="form-row"><label>结束日期</label>' +
        '<input name="end" type="date" value="' + defaultEndStr + '"></div>' +
        '</div>' +
        '<div class="btn-row"><button type="button" class="btn" id="pqf-cancel">取消</button>' +
        '<button type="submit" class="btn primary">保存</button></div></form>';
      var root = window._openModal(html);
      root.querySelector('#pqf-cancel').onclick = window._closeModal;
      root.querySelector('#period-quick-form').onsubmit = function(e) {
        e.preventDefault();
        var f = e.target;
        var start = f.start.value;
        var end = f.end.value || start;
        if (start > end) { alert('结束日期不能早于开始日期'); return; }
        data.records.push({ start: start, end: end });
        savePeriodData(data);
        window._closeModal();
        refreshPeriod();
      };
    }
  }

  function openPeriodEditForm(record, idx) {
    var r = record || {};
    var html = '<h3>编辑经期记录</h3>' +
      '<form id="period-edit-form">' +
      '<div class="form-two-col">' +
      '<div class="form-row"><label>开始日期</label>' +
      '<input name="start" type="date" required value="' + (r.start || today()) + '"></div>' +
      '<div class="form-row"><label>结束日期</label>' +
      '<input name="end" type="date" value="' + (r.end || r.start || today()) + '"></div>' +
      '</div>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn danger" id="pef-del">删除</button>' +
      '<button type="button" class="btn" id="pef-cancel">取消</button>' +
      '<button type="submit" class="btn primary">保存</button></div></form>';
    var root = window._openModal(html);
    root.querySelector('#pef-cancel').onclick = window._closeModal;
    root.querySelector('#pef-del').onclick = function() {
      if (!confirm('删除这条经期记录？')) return;
      var data = loadPeriodData();
      data.records.splice(idx, 1);
      savePeriodData(data);
      window._closeModal();
      refreshPeriod();
    };
    root.querySelector('#period-edit-form').onsubmit = function(e) {
      e.preventDefault();
      var f = e.target;
      var start = f.start.value;
      var end = f.end.value || start;
      if (start > end) { alert('结束日期不能早于开始日期'); return; }
      var data = loadPeriodData();
      data.records[idx] = { start: start, end: end };
      savePeriodData(data);
      window._closeModal();
      refreshPeriod();
    };
  }

  function openPeriodSettings() {
    var data = loadPeriodData();
    var html = '<h3>姨妈日历设置</h3>' +
      '<form id="period-settings-form">' +
      '<div class="form-two-col">' +
      '<div class="form-row"><label>平均周期 (天)</label>' +
      '<input name="cycleLength" type="number" min="20" max="50" value="' + data.cycleLength + '"></div>' +
      '<div class="form-row"><label>经期天数 (天)</label>' +
      '<input name="periodLength" type="number" min="2" max="10" value="' + data.periodLength + '"></div>' +
      '</div>' +
      '<div class="muted small" style="margin-top:4px">系统会根据历史经期记录自动计算实际平均周期</div>' +
      '<div class="btn-row"><button type="button" class="btn" id="ps-cancel">取消</button>' +
      '<button type="submit" class="btn primary">保存</button></div></form>';
    var root = window._openModal(html);
    root.querySelector('#ps-cancel').onclick = window._closeModal;
    root.querySelector('#period-settings-form').onsubmit = function(e) {
      e.preventDefault();
      var f = e.target;
      data.cycleLength = parseInt(f.cycleLength.value) || 28;
      data.periodLength = parseInt(f.periodLength.value) || 5;
      savePeriodData(data);
      window._closeModal();
      refreshPeriod();
    };
  }

  function refreshPeriod() {
    var el = document.getElementById('health-period');
    if (el) el.innerHTML = renderPeriodTab();
    bindPeriodEvents();
  }

  function bindPeriodEvents() {
    var el = document.getElementById('view-health');
    if (!el) return;
    var prev = document.getElementById('pc-prev');
    var next = document.getElementById('pc-next');
    if (prev) prev.onclick = function() {
      pCalMonth--;
      if (pCalMonth < 0) { pCalMonth = 11; pCalYear--; }
      refreshPeriod();
    };
    if (next) next.onclick = function() {
      pCalMonth++;
      if (pCalMonth > 11) { pCalMonth = 0; pCalYear++; }
      refreshPeriod();
    };
    var title = document.getElementById('pc-title');
    if (title) title.onclick = function() {
      var mNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      var html = '<h3>选择年月</h3><div style="margin:12px 0">';
      html += '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">年份</div><div class="pick" style="margin-bottom:12px">';
      for (var y = pCalYear - 3; y <= pCalYear + 3; y++) {
        html += '<div class="pk' + (y === pCalYear ? ' on' : '') + '" data-pick-year="' + y + '" style="width:auto;padding:0 12px;border-radius:8px;font-size:14px">' + y + '</div>';
      }
      html += '</div><div style="font-size:13px;color:var(--muted);margin-bottom:6px">月份</div><div class="pick">';
      mNames.forEach(function(name, i) {
        html += '<div class="pk' + (i === pCalMonth ? ' on' : '') + '" data-pick-month="' + i + '" style="width:auto;padding:4px 10px;border-radius:8px;font-size:13px">' + name + '</div>';
      });
      html += '</div></div>';
      html += '<div class="btn-row"><button class="btn" id="pym-cancel">取消</button>' +
        '<button class="btn primary" id="pym-ok">确定</button></div>';
      var root = window._openModal(html);
      var pickYear = pCalYear, pickMonth = pCalMonth;
      root.querySelectorAll('[data-pick-year]').forEach(function(p) {
        p.onclick = function() {
          pickYear = parseInt(p.dataset.pickYear, 10);
          root.querySelectorAll('[data-pick-year]').forEach(function(x) { x.classList.remove('on'); });
          p.classList.add('on');
        };
      });
      root.querySelectorAll('[data-pick-month]').forEach(function(p) {
        p.onclick = function() {
          pickMonth = parseInt(p.dataset.pickMonth, 10);
          root.querySelectorAll('[data-pick-month]').forEach(function(x) { x.classList.remove('on'); });
          p.classList.add('on');
        };
      });
      root.querySelector('#pym-cancel').onclick = window._closeModal;
      root.querySelector('#pym-ok').onclick = function() {
        pCalYear = pickYear; pCalMonth = pickMonth;
        window._closeModal(); refreshPeriod();
      };
    };
    el.querySelectorAll('#health-period .cal-cell[data-date]').forEach(function(cell) {
      cell.onclick = function() { openPeriodDaySheet(cell.dataset.date); };
    });
    var settingsBtn = document.getElementById('pc-settings');
    if (settingsBtn) settingsBtn.onclick = openPeriodSettings;
    el.querySelectorAll('#health-period .period-history-item').forEach(function(item) {
      item.onclick = function() {
        var data = loadPeriodData();
        var sorted = data.records.slice().sort(function(a, b) { return b.start.localeCompare(a.start); });
        var idx = parseInt(item.dataset.pidx, 10);
        openPeriodEditForm(sorted[idx], data.records.indexOf(sorted[idx]));
      };
    });
  }

  // ===== FAB =====
  function updateHealthFab() {
    var fab = document.getElementById('fab-health');
    if (!fab) return;
    var show = (tab === 'body' || tab === 'exercise') &&
      !document.getElementById('view-health').classList.contains('hidden');
    fab.classList.toggle('hidden', !show);
  }

  function onHealthFabClick() {
    if (tab === 'body') openBodyModal();
    else if (tab === 'exercise') openExerciseForm(today());
  }

  // ===== Public API =====
  function render() {
    var el = document.getElementById('view-health');
    if (!el) return;
    var html = '';
    html += '<div id="health-body"' + (tab !== 'body' ? ' class="hidden"' : '') + '>' + renderBodyTab() + '</div>';
    html += '<div id="health-exercise"' + (tab !== 'exercise' ? ' class="hidden"' : '') + '>' + renderExerciseTab() + '</div>';
    html += '<div id="health-period"' + (tab !== 'period' ? ' class="hidden"' : '') + '>' + renderPeriodTab() + '</div>';
    el.innerHTML = html;

    // Body events
    el.querySelectorAll('.health-rec').forEach(function(r) {
      r.onclick = function() { openBodyDetail(parseInt(r.dataset.idx, 10)); };
    });

    bindCalEvents();
    bindPeriodEvents();
    updateHealthFab();
  }

  function refreshExercise() {
    var exEl = document.getElementById('health-exercise');
    if (exEl) exEl.innerHTML = renderExerciseTab();
    bindCalEvents();
  }

  function bindCalEvents() {
    var el = document.getElementById('view-health');
    if (!el) return;

    // Nav arrows
    var calPrev = document.getElementById('cal-prev');
    var calNext = document.getElementById('cal-next');
    if (calPrev) calPrev.onclick = function() {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      refreshExercise();
    };
    if (calNext) calNext.onclick = function() {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      refreshExercise();
    };

    // Year/month picker
    var calTitle = document.getElementById('cal-title');
    if (calTitle) calTitle.onclick = function() {
      var mNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      var html = '<h3>选择年月</h3><div style="margin:12px 0">';
      // Year selector
      html += '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">年份</div><div class="pick" style="margin-bottom:12px">';
      for (var y = calYear - 3; y <= calYear + 3; y++) {
        html += '<div class="pk' + (y === calYear ? ' on' : '') + '" data-pick-year="' + y + '" style="width:auto;padding:0 12px;border-radius:8px;font-size:14px">' + y + '</div>';
      }
      html += '</div>';
      // Month selector
      html += '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">月份</div><div class="pick">';
      mNames.forEach(function(name, i) {
        html += '<div class="pk' + (i === calMonth ? ' on' : '') + '" data-pick-month="' + i + '" style="width:auto;padding:4px 10px;border-radius:8px;font-size:13px">' + name + '</div>';
      });
      html += '</div></div>';
      html += '<div class="btn-row"><button class="btn" id="ym-cancel">取消</button>' +
        '<button class="btn primary" id="ym-ok">确定</button></div>';
      var root = window._openModal(html);
      var pickYear = calYear, pickMonth = calMonth;
      root.querySelectorAll('[data-pick-year]').forEach(function(p) {
        p.onclick = function() {
          pickYear = parseInt(p.dataset.pickYear, 10);
          root.querySelectorAll('[data-pick-year]').forEach(function(x) { x.classList.remove('on'); });
          p.classList.add('on');
        };
      });
      root.querySelectorAll('[data-pick-month]').forEach(function(p) {
        p.onclick = function() {
          pickMonth = parseInt(p.dataset.pickMonth, 10);
          root.querySelectorAll('[data-pick-month]').forEach(function(x) { x.classList.remove('on'); });
          p.classList.add('on');
        };
      });
      root.querySelector('#ym-cancel').onclick = window._closeModal;
      root.querySelector('#ym-ok').onclick = function() {
        calYear = pickYear;
        calMonth = pickMonth;
        window._closeModal();
        refreshExercise();
      };
    };

    // Day cell clicks
    el.querySelectorAll('.cal-cell[data-date]').forEach(function(cell) {
      cell.onclick = function() {
        var ds = cell.dataset.date;
        var exercises = loadExer();
        var dayEx = exercises.filter(function(e) { return e.date === ds; });
        if (dayEx.length) {
          // Show day detail
          var html = '<h3>' + ds + ' 运动记录</h3>';
          dayEx.forEach(function(e, i) {
            html += '<div class="row" style="justify-content:space-between">' +
              '<span>' + esc(e.type) + ' · ' + e.duration + 'min</span>' +
              '<button class="btn small danger exer-del" data-date="' + e.date + '" data-idx="' + i + '">删除</button></div>';
          });
          html += '<div class="btn-row"><button class="btn" id="dd-close">关闭</button>' +
            '<button class="btn primary" id="dd-add">追加运动</button></div>';
          var root = window._openModal(html);
          root.querySelector('#dd-close').onclick = window._closeModal;
          root.querySelector('#dd-add').onclick = function() {
            window._closeModal();
            setTimeout(function() { openExerciseForm(ds); }, 100);
          };
          root.querySelectorAll('.exer-del').forEach(function(btn) {
            btn.onclick = function() {
              if (!confirm('删除这条运动记录？')) return;
              var recs = loadExer();
              var target = recs.filter(function(e) { return e.date === btn.dataset.date; })[parseInt(btn.dataset.idx, 10)];
              if (target) recs = recs.filter(function(e) { return e !== target; });
              saveExer(recs);
              window._closeModal();
              render();
            };
          });
        } else {
          openExerciseForm(ds);
        }
      };
    });
  }

  function switchTab(t) { tab = t; render(); updateHealthFab(); }

  // Data access for backup/restore
  function exportData() {
    return JSON.stringify({ body: loadBody(), exercise: loadExer(), periods: loadPeriodData() });
  }
  function importData(json) {
    try {
      var d = JSON.parse(json);
      if (d.body) saveBody(d.body);
      if (d.exercise) saveExer(d.exercise);
      if (d.periods) savePeriodData(d.periods);
    } catch(e) {}
  }

  return { render: render, switchTab: switchTab, exportData: exportData, importData: importData,
           updateFab: updateHealthFab, onFabClick: onHealthFabClick };
})();
