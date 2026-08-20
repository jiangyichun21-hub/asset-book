/* global */
'use strict';
var Notes = (function() {

  var LS_NOTES = 'assetbook.notes';
  var LS_TAGS = 'assetbook.noteTags';
  var notes = [];
  var tags = [];
  var searchQuery = '';
  var activeTag = '';

  // ===== Data =====
  function loadData() {
    try { notes = JSON.parse(localStorage.getItem(LS_NOTES)) || []; } catch(e) { notes = []; }
    try { tags = JSON.parse(localStorage.getItem(LS_TAGS)) || []; } catch(e) { tags = []; }
  }
  function saveNotes() { localStorage.setItem(LS_NOTES, JSON.stringify(notes)); }
  function saveTags() { localStorage.setItem(LS_TAGS, JSON.stringify(tags)); }
  function ensureTag(t) {
    if (t && tags.indexOf(t) === -1) { tags.push(t); tags.sort(); saveTags(); }
  }
  function genId() { return 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

  // ===== Formatting =====
  function fmtDate(ts) {
    var d = new Date(ts);
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    var hh = ('0' + d.getHours()).slice(-2);
    var mi = ('0' + d.getMinutes()).slice(-2);
    return mm + '-' + dd + ' ' + hh + ':' + mi;
  }
  function stripHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

  // ===== Filtering =====
  function getFiltered() {
    var list = notes.slice();
    if (activeTag) {
      list = list.filter(function(n) { return n.tags && n.tags.indexOf(activeTag) !== -1; });
    }
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      list = list.filter(function(n) {
        return (n.title || '').toLowerCase().indexOf(q) !== -1 ||
               stripHtml(n.content || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    list.sort(function(a, b) { return b.updatedAt - a.updatedAt; });
    return list;
  }

  // ===== Tag Colors =====
  var TAG_COLORS = ['#6366f1', '#e6413d', '#12b76a', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
  function tagColor(t) {
    var hash = 0;
    for (var i = 0; i < t.length; i++) hash = ((hash << 5) - hash + t.charCodeAt(i)) | 0;
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  }

  // ===== Render =====
  function render() {
    loadData();
    var view = document.getElementById('view-notes');
    if (!view) return;

    var filtered = getFiltered();
    var html = '';

    // Search bar
    html += '<div class="notes-search"><input type="text" id="notes-search-input" placeholder="搜索笔记…" value="' +
      (searchQuery || '').replace(/"/g, '&quot;') + '"></div>';

    // Tag filter
    if (tags.length > 0) {
      html += '<div class="notes-tags">';
      html += '<span class="note-tag-chip' + (!activeTag ? ' active' : '') + '" data-tag="">全部</span>';
      tags.forEach(function(t) {
        var c = tagColor(t);
        html += '<span class="note-tag-chip' + (activeTag === t ? ' active' : '') +
          '" data-tag="' + t.replace(/"/g, '&quot;') +
          '" style="--tag-color:' + c + '">' + t + '</span>';
      });
      html += '</div>';
    }

    // Note list
    if (filtered.length === 0) {
      html += '<div class="empty-state"><div style="font-size:36px;margin-bottom:8px">📝</div>' +
        '<div style="color:var(--muted);font-size:14px">' +
        (notes.length === 0 ? '还没有笔记，点右下角 ＋ 添加' : '没有匹配的笔记') +
        '</div></div>';
    } else {
      html += '<div class="notes-list">';
      filtered.forEach(function(n) {
        var preview = truncate(stripHtml(n.content || ''), 80);
        var title = n.title || truncate(stripHtml(n.content || ''), 30) || '无标题';
        var tagDots = '';
        if (n.tags && n.tags.length) {
          n.tags.forEach(function(t) {
            tagDots += '<span class="note-tag-dot" style="background:' + tagColor(t) + '"></span>' +
              '<span class="note-tag-label">' + t + '</span>';
          });
        }
        html += '<div class="note-card-wrap" data-id="' + n.id + '">' +
          '<div class="note-card-row">' +
            '<div class="note-card">' +
              '<div class="note-card-title">' + title + '</div>' +
              '<div class="note-card-preview">' + preview + '</div>' +
              '<div class="note-card-meta">' +
                '<span class="note-card-tags">' + tagDots + '</span>' +
                '<span class="note-card-time">' + fmtDate(n.updatedAt) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="note-card-actions">' +
              '<button class="note-card-btn edit" data-action="edit">编辑</button>' +
              '<button class="note-card-btn delete" data-action="delete">删除</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    view.innerHTML = html;
    bindEvents();
  }

  // ===== Swipe Logic =====
  function bindEvents() {
    var view = document.getElementById('view-notes');
    if (!view) return;

    // Search
    var searchInput = document.getElementById('notes-search-input');
    if (searchInput) {
      searchInput.oninput = function() {
        searchQuery = this.value;
        render();
        // Re-focus and restore cursor
        var inp = document.getElementById('notes-search-input');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      };
    }

    // Tag filter
    view.querySelectorAll('.note-tag-chip').forEach(function(chip) {
      chip.onclick = function() {
        activeTag = this.dataset.tag || '';
        render();
      };
    });

    // Card tap → edit
    view.querySelectorAll('.note-card').forEach(function(card) {
      card.onclick = function() {
        var id = this.closest('.note-card-wrap').dataset.id;
        var note = notes.find(function(n) { return n.id === id; });
        if (note) openNoteForm(note);
      };
    });

    // Swipe
    view.querySelectorAll('.note-card-wrap').forEach(function(wrap) {
      var row = wrap.querySelector('.note-card-row');
      var startX = 0, startY = 0, moved = false, opened = false;

      wrap.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        moved = false;
        row.style.transition = 'none';
      }, { passive: true });

      wrap.addEventListener('touchmove', function(e) {
        var dx = e.touches[0].clientX - startX;
        var dy = e.touches[0].clientY - startY;
        if (Math.abs(dy) > Math.abs(dx)) return;
        moved = true;
        if (dx < 0) {
          row.style.transform = 'translateX(' + Math.max(dx, -120) + 'px)';
        } else if (opened) {
          row.style.transform = 'translateX(' + Math.min(0, dx - 120) + 'px)';
        }
      }, { passive: true });

      wrap.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - startX;
        row.style.transition = 'transform 0.2s';
        if (dx < -30) {
          row.style.transform = 'translateX(-120px)';
          opened = true;
        } else {
          row.style.transform = 'translateX(0)';
          opened = false;
        }
      }, { passive: true });
    });

    // Swipe action buttons
    view.querySelectorAll('.note-card-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var id = this.closest('.note-card-wrap').dataset.id;
        var action = this.dataset.action;
        if (action === 'edit') {
          var note = notes.find(function(n) { return n.id === id; });
          if (note) openNoteForm(note);
        } else if (action === 'delete') {
          if (confirm('删除这条笔记？')) {
            notes = notes.filter(function(n) { return n.id !== id; });
            saveNotes();
            render();
          }
        }
      };
    });

    // Close opened cards on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.note-card-wrap')) {
        document.querySelectorAll('.note-card-row').forEach(function(row) {
          row.style.transition = 'transform 0.2s';
          row.style.transform = 'translateX(0)';
        });
      }
    });
  }

  // ===== Note Form (Create / Edit) =====
  function openNoteForm(note) {
    var isEdit = !!note;
    var r = note || { title: '', content: '', tags: [] };

    var html = '<h3>' + (isEdit ? '编辑笔记' : '新建笔记') + '</h3>';
    html += '<div class="note-form">';
    // Title
    html += '<input type="text" id="note-title" class="note-title-input" placeholder="标题（可选）" value="' +
      (r.title || '').replace(/"/g, '&quot;') + '">';
    // Tags
    html += '<div class="note-form-tags" id="note-form-tags">';
    tags.forEach(function(t) {
      var checked = r.tags && r.tags.indexOf(t) !== -1;
      html += '<span class="note-form-tag' + (checked ? ' active' : '') +
        '" data-tag="' + t.replace(/"/g, '&quot;') + '">' + t + '</span>';
    });
    html += '<input type="text" id="note-new-tag" class="note-new-tag-input" placeholder="+ 新标签">';
    html += '</div>';
    // Rich text editor
    html += '<div class="note-toolbar" id="note-toolbar">' +
      '<button type="button" class="nt-btn" data-cmd="bold" title="加粗"><b>B</b></button>' +
      '<button type="button" class="nt-btn" data-cmd="insertUnorderedList" title="列表">☰</button>' +
      '<button type="button" class="nt-btn" data-cmd="insertOrderedList" title="编号">1.</button>' +
      '<button type="button" class="nt-btn" data-cmd="formatBlock" data-val="H3" title="标题">H</button>' +
      '</div>';
    html += '<div class="note-editor" id="note-editor" contenteditable="true">' + (r.content || '') + '</div>';
    // Buttons
    html += '<div class="btn-row" style="margin-top:12px">' +
      '<button type="button" class="btn" id="note-cancel">取消</button>' +
      '<button type="button" class="btn primary" id="note-save">保存</button></div>';
    html += '</div>';

    var root = window._openModal(html);
    var selectedTags = (r.tags || []).slice();

    // Tag toggle
    root.querySelectorAll('.note-form-tag').forEach(function(el) {
      el.onclick = function() {
        var t = this.dataset.tag;
        var idx = selectedTags.indexOf(t);
        if (idx === -1) selectedTags.push(t);
        else selectedTags.splice(idx, 1);
        this.classList.toggle('active');
      };
    });

    // New tag input
    var newTagInput = root.querySelector('#note-new-tag');
    if (newTagInput) {
      newTagInput.onkeydown = function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var v = this.value.trim();
          if (v) {
            ensureTag(v);
            selectedTags.push(v);
            // Re-render tag area
            var tagContainer = root.querySelector('#note-form-tags');
            var chip = document.createElement('span');
            chip.className = 'note-form-tag active';
            chip.dataset.tag = v;
            chip.textContent = v;
            chip.onclick = function() {
              var t = this.dataset.tag;
              var idx = selectedTags.indexOf(t);
              if (idx === -1) selectedTags.push(t);
              else selectedTags.splice(idx, 1);
              this.classList.toggle('active');
            };
            tagContainer.insertBefore(chip, newTagInput);
            this.value = '';
          }
        }
      };
    }

    // Rich text toolbar
    root.querySelectorAll('.nt-btn').forEach(function(btn) {
      btn.onmousedown = function(e) { e.preventDefault(); }; // prevent blur
      btn.onclick = function(e) {
        e.preventDefault();
        var cmd = this.dataset.cmd;
        var val = this.dataset.val || null;
        if (cmd === 'formatBlock') val = '<' + val + '>';
        document.execCommand(cmd, false, val);
        root.querySelector('#note-editor').focus();
      };
    });

    // Cancel
    root.querySelector('#note-cancel').onclick = function() { window._closeModal(); };

    // Save
    root.querySelector('#note-save').onclick = function() {
      var title = root.querySelector('#note-title').value.trim();
      var content = root.querySelector('#note-editor').innerHTML.trim();
      if (!title && !stripHtml(content)) { alert('请输入内容'); return; }

      var now = Date.now();
      if (isEdit) {
        note.title = title;
        note.content = content;
        note.tags = selectedTags;
        note.updatedAt = now;
      } else {
        notes.push({
          id: genId(),
          title: title,
          content: content,
          tags: selectedTags,
          createdAt: now,
          updatedAt: now
        });
      }
      // Ensure all selected tags exist
      selectedTags.forEach(ensureTag);
      saveNotes();
      saveTags();
      window._closeModal();
      render();
    };
  }

  // ===== FAB =====
  function updateFab() {
    var fab = document.getElementById('fab-notes');
    if (!fab) return;
    var show = !document.getElementById('view-notes').classList.contains('hidden');
    fab.classList.toggle('hidden', !show);
  }
  function onFabClick() {
    openNoteForm(null);
  }

  // ===== Export / Import =====
  function exportData() { return { notes: notes, tags: tags }; }
  function importData(data) {
    if (data && data.notes) { notes = data.notes; saveNotes(); }
    if (data && data.tags) { tags = data.tags; saveTags(); }
  }

  // Public API
  return {
    render: render,
    updateFab: updateFab,
    onFabClick: onFabClick,
    exportData: exportData,
    importData: importData
  };
})();
