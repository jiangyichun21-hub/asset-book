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

    // Add buttons
    html += '<div class="btn-row" style="margin-bottom:12px">' +
      '<button class="btn primary" id="btn-add-body" style="flex:1">手动记录</button>' +
      '<button class="btn" id="btn-ocr-body" style="flex:1">拍照识别</button></div>';

    // History
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
    } else {
      html += '<div class="card muted center">还没有记录，点上方按钮添加</div>';
    }
    return html;
  }

  function openBodyForm(record, prefill) {
    var isEdit = !!record;
    var r = record || prefill || {};
    var html = '<h3>' + (isEdit ? '编辑体脂记录' : '记录体脂数据') + '</h3>' +
      '<form id="body-form"><div class="form-row"><label>日期</label>' +
      '<input name="date" type="date" required value="' + (r.date || today()) + '"></div>';
    // Core fields
    html += '<div class="form-two-col">';
    CORE_FIELDS.forEach(function(k) {
      var f = BODY_FIELDS.find(function(x) { return x.key === k; });
      html += '<div class="form-row"><label>' + f.label + (f.unit ? ' (' + f.unit + ')' : '') + '</label>' +
        '<input name="' + k + '" type="number" step="0.1" value="' + (r[k] != null ? r[k] : '') + '"></div>';
    });
    html += '</div>';
    // Optional fields (collapsed)
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

    var root = window._openModal(html);
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
      '<span style="font-weight:600;font-size:15px">' + calYear + '年 ' + mNames[calMonth] + '</span>' +
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

    html += '<button class="btn primary block" id="btn-add-exer" style="margin-top:12px">记录运动</button>';
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

  // ===== OCR (qwen-vl) =====
  var OCR_KEY_DEFAULT = 'sk-ws-H.EPRRRHI.HlbR.MEYCIQDrYAyIGWpKBXwWUf0Hi3BLICroawr8-HYbqM4ErV0odAIhAMsVp6Hr07NR1hswIIgUqPhViBiJFgAy2o0RmjayrYpg';
  var OCR_PROMPT = '请从这张体脂秤/体成分报告中提取以下数据，以JSON格式返回（只返回JSON，不要其他文字）。' +
    '字段：weight(体重kg), bodyFat(体脂率%), muscle(肌肉量kg), bmi(BMI), bmr(基础代谢kcal), visceralFat(内脏脂肪指数), ' +
    'water(体水分kg), protein(蛋白质kg), boneMass(骨量kg), fatMass(脂肪量kg), skeletalMuscle(骨骼肌kg), date(报告日期YYYY-MM-DD)。' +
    '如果某个字段在图中找不到，设为null。数字用number类型，不要用字符串。';

  function startOcr() {
    var key = (window._getAiKey && window._getAiKey()) || OCR_KEY_DEFAULT;
    // Create hidden file input
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function() {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        var base64 = reader.result;
        callQwenVl(key, base64, function(err, data) {
          if (err) { alert('识别失败：' + err); return; }
          openBodyFormWithOcr(data);
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function callQwenVl(key, imageBase64, cb) {
    // Show loading toast
    var toast = document.createElement('div');
    toast.textContent = '正在识别…';
    toast.style.cssText = 'position:fixed;bottom:calc(90px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:rgba(0,0,0,.78);color:#fff;padding:9px 18px;border-radius:20px;font-size:14px;z-index:300;';
    document.body.appendChild(toast);

    fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageBase64 } },
            { type: 'text', text: OCR_PROMPT }
          ]
        }]
      })
    }).then(function(res) {
      if (!res.ok) return res.text().then(function(t) { throw new Error('API ' + res.status + ': ' + t); });
      return res.json();
    }).then(function(json) {
      toast.remove();
      var text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (!text) throw new Error('返回内容为空');
      // Extract JSON from response (may be wrapped in markdown code blocks)
      var match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('无法解析返回数据');
      var data = JSON.parse(match[0]);
      cb(null, data);
    }).catch(function(e) {
      toast.remove();
      cb(e.message || String(e));
    });
  }

  function openBodyFormWithOcr(ocrData) {
    var r = { date: ocrData.date || today() };
    BODY_FIELDS.forEach(function(f) {
      if (ocrData[f.key] != null && ocrData[f.key] !== '' && !isNaN(ocrData[f.key])) {
        r[f.key] = Number(ocrData[f.key]);
      }
    });
    openBodyForm(null, r);
  }

  // ===== Public API =====
  function render() {
    var el = document.getElementById('view-health');
    if (!el) return;
    var html = '';
    html += '<div id="health-body"' + (tab !== 'body' ? ' class="hidden"' : '') + '>' + renderBodyTab() + '</div>';
    html += '<div id="health-exercise"' + (tab !== 'exercise' ? ' class="hidden"' : '') + '>' + renderExerciseTab() + '</div>';
    el.innerHTML = html;

    // Body events
    var addBody = document.getElementById('btn-add-body');
    if (addBody) addBody.onclick = function() { openBodyForm(null); };
    var ocrBtn = document.getElementById('btn-ocr-body');
    if (ocrBtn) ocrBtn.onclick = function() { startOcr(); };
    el.querySelectorAll('.health-rec').forEach(function(r) {
      r.onclick = function() { openBodyDetail(parseInt(r.dataset.idx, 10)); };
    });

    // Exercise events
    var addExer = document.getElementById('btn-add-exer');
    if (addExer) addExer.onclick = function() { openExerciseForm(today()); };
    var calPrev = document.getElementById('cal-prev');
    var calNext = document.getElementById('cal-next');
    if (calPrev) calPrev.onclick = function() {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      var exEl = document.getElementById('health-exercise');
      if (exEl) exEl.innerHTML = renderExerciseTab();
      bindCalEvents();
    };
    if (calNext) calNext.onclick = function() {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      var exEl = document.getElementById('health-exercise');
      if (exEl) exEl.innerHTML = renderExerciseTab();
      bindCalEvents();
    };
    bindCalEvents();
  }

  function bindCalEvents() {
    var el = document.getElementById('view-health');
    if (!el) return;
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

  function switchTab(t) { tab = t; render(); }

  // Data access for backup/restore
  function exportData() {
    return JSON.stringify({ body: loadBody(), exercise: loadExer() });
  }
  function importData(json) {
    try {
      var d = JSON.parse(json);
      if (d.body) saveBody(d.body);
      if (d.exercise) saveExer(d.exercise);
    } catch(e) {}
  }

  return { render: render, switchTab: switchTab, exportData: exportData, importData: importData };
})();
