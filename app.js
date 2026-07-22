// ===== 纯JS SHA256 =====
function sha256(msg) {
  function R(n,v){return((n>>>v)|(n<<(32-v)))>>>0}
  function S(n,v){return(n>>>v)>>>0}
  function A(x,y){var l=(x&0xffff)+(y&0xffff);var h=(x>>>16)+(y>>>16)+(l>>>16);return((h<<16)|(l&0xffff))>>>0}
  var K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
  var H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];
  var b=unescape(encodeURIComponent(msg));
  var bl=b.length,ml=(bl+9+(((-(bl+9))%64)+64)%64);
  var mb=new ArrayBuffer(ml),mv=new DataView(mb);
  for(var i=0;i<bl;i++)mv.setUint8(i,b.charCodeAt(i));
  mv.setUint8(bl,128);mv.setUint32(ml-4,bl*8,false);
  for(var o=0;o<ml;o+=64){
    var W=new Array(64),a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(var i=0;i<16;i++)W[i]=mv.getUint32(o+i*4,false);
    for(var i=16;i<64;i++){var s0=(R(W[i-15],7)^R(W[i-15],18)^S(W[i-15],3))>>>0;var s1=(R(W[i-2],17)^R(W[i-2],19)^S(W[i-2],10))>>>0;W[i]=A(A(A(s1,W[i-7]),s0),W[i-16]);}
    for(var i=0;i<64;i++){var S1=(R(e,6)^R(e,11)^R(e,25))>>>0;var ch=((e&f)^(~e&g))>>>0;var t1=A(A(A(A(h,S1),ch),K[i]),W[i]);var S0=(R(a,2)^R(a,13)^R(a,22))>>>0;var maj=((a&b)^(a&c)^(b&c))>>>0;var t2=A(S0,maj);h=g;g=f;f=e;e=A(d,t1);d=c;c=b;b=a;a=A(t1,t2);}
    H[0]=A(a,H[0]);H[1]=A(b,H[1]);H[2]=A(c,H[2]);H[3]=A(d,H[3]);H[4]=A(e,H[4]);H[5]=A(f,H[5]);H[6]=A(g,H[6]);H[7]=A(h,H[7]);
  }
  var hex='';for(var i=0;i<8;i++)hex+=H[i].toString(16).padStart(8,'0');
  return hex;
}

var USERS = __USERS__;
var TOKEN_KEY = 'ledger_login_v5';
var GH_TOKEN_KEY = 'ledger_gh_token';
var GH_REPO = 'fsgjk/Computer';
var DATA = [];
var DATA_SHA = null;
var GH_TOKEN = localStorage.getItem(GH_TOKEN_KEY) || '';
var FIELDS = ['序号','当前位置','公用个人','责任人','资产编号','用户名','MAC地址','是否加域','IP地址','所属部门','采购日期','使用年限','本地账号','本地密码','分类','CPU','内存','硬盘','操作系统','备注'];
var LOGIN_USER = null;
var editingId = null, currentPage = 1, pageSize = 50, confirmCb = null, searchTimer = null, filterMode = '', sortField = '', sortDir = 1;
var opLogs = JSON.parse(localStorage.getItem('ledger_op_logs') || '[]');
var clientIP = '';

// 从 GitHub data.json 加载数据（带 localStorage 兜底）
(function() {
  // 1. 立即从页面内嵌数据初始化
  var el = document.getElementById('ledger-data');
  if(el && el.textContent) {
    try { DATA = JSON.parse(el.textContent); } catch(e) {}
  }

  // 2. 尝试从localStorage恢复更新的数据
  try {
    var saved = localStorage.getItem('ledger_data_backup');
    if(saved) {
      var p = JSON.parse(saved);
      if(p.length > 0) DATA = p;
    }
  } catch(e) {}

  // 3. 如果有token，后台静默从GitHub同步
  if(GH_TOKEN) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.github.com/repos/'+GH_REPO+'/contents/data.json?ref=main', true);
    xhr.setRequestHeader('Authorization', 'token '+GH_TOKEN);
    xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
    xhr.timeout = 8000;
    xhr.onload = function() {
      if(xhr.status === 200) {
        try {
          var info = JSON.parse(xhr.responseText);
          DATA_SHA = info.sha;
          var remoteData = JSON.parse(atob(info.content.replace(/\s/g,'')));
          if(remoteData.length > 0) {
            DATA = remoteData;
            try { localStorage.setItem('ledger_data_backup', JSON.stringify(DATA)); } catch(e) {}
          }
        } catch(e) {}
      }
    };
    xhr.send();
  }

  // 数据已就绪
  dataSyncReady = true;
})();

// 保存数据到 GitHub
function syncToGitHub(callback) {
  if(!GH_TOKEN) return;
  var content = JSON.stringify(DATA, null, 2);
  var b64 = btoa(unescape(encodeURIComponent(content)));
  var payload = {message: 'update data.json', content: b64};
  if(DATA_SHA) payload.sha = DATA_SHA;

  var xhr = new XMLHttpRequest();
  xhr.open('PUT', 'https://api.github.com/repos/'+GH_REPO+'/contents/data.json', true);
  xhr.setRequestHeader('Authorization', 'token '+GH_TOKEN);
  xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    if(xhr.status === 200 || xhr.status === 201) {
      try {
        var resp = JSON.parse(xhr.responseText);
        DATA_SHA = resp.content.sha;
      } catch(e) {}
    }
    if(callback) callback(xhr.status === 200 || xhr.status === 201);
  };
  xhr.onerror = function() { if(callback) callback(false); };
  xhr.send(JSON.stringify(payload));
}

// 数据持久化：存localStorage + 同步GitHub
function saveDataToStorage() {
  try { localStorage.setItem('ledger_data_backup', JSON.stringify(DATA)); } catch(e) {}
  syncToGitHub();
}

// 获取公网IP
(function() {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.ipify.org?format=json', true);
    xhr.onload = function() {
      if(xhr.status === 200) {
        var resp = JSON.parse(xhr.responseText);
        clientIP = resp.ip || '';
      }
    };
    xhr.send();
  } catch(e) {}
})();

// ===== 操作日志 =====
function addOpLog(action, target, detail) {
  if(!LOGIN_USER) return;
  opLogs.push({time: new Date().toLocaleString(), user: LOGIN_USER.name, username: LOGIN_USER.username, action: action, target: target, detail: detail, ip: clientIP});
  if(opLogs.length > 500) opLogs = opLogs.slice(-500);
  localStorage.setItem('ledger_op_logs', JSON.stringify(opLogs));
  refreshLogPanel();
}
function refreshLogPanel() {
  // 日志改为弹窗模式，不自动显示在主界面
}

function showLogPanel() {
  var list = document.getElementById('logListFull');
  if(opLogs.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--neutral-400)">暂无操作记录</div>';
  } else {
    var all = opLogs.slice().reverse();
    list.innerHTML = all.map(function(l) {
      var icon = l.action==='新增'?'➕':l.action==='删除'?'🗑':l.action==='导出'?'📥':l.action==='导入'?'📤':'✏';
      var color = l.action==='新增'?'#3B6D11':l.action==='删除'?'#A32D2D':'#185FA5';
      return '<div style="padding:8px 0;border-bottom:0.5px solid var(--neutral-50)"><span style="font-size:11px;color:var(--neutral-400)">'+l.time+'</span> <span style="color:'+color+';font-weight:500">'+icon+' '+l.action+'</span> <strong>'+l.user+'</strong> <span style="color:var(--neutral-800)">'+l.target+'</span>'+(l.detail?'<div style="font-size:11px;color:var(--neutral-400);margin-top:2px">'+l.detail+'</div>':'')+(l.ip?'<span style="font-size:10px;color:var(--neutral-400);margin-left:8px">IP:'+l.ip+'</span>':'')+'</div>';
    }).join('');
  }
  document.getElementById('logModal').classList.add('active');
}

function closeLogPanel() {
  document.getElementById('logModal').classList.remove('active');
}

function exportLogs() {
  var csv = '\uFEFF时间,用户,操作,目标,详情,IP\n';
  opLogs.forEach(function(l) {
    csv += [l.time, l.user, l.action, l.target, l.detail||'', l.ip||''].map(function(v){ var s=String(v); if(s.includes(',')||s.includes('"')) s='"'+s.replace(/"/g,'""')+'"'; return s; }).join(',') + '\n';
  });
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '操作日志_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  showToast('日志已导出', 'success');
}
function clearLogs() { opLogs = []; localStorage.removeItem('ledger_op_logs'); closeLogPanel(); showToast('日志已清空', 'success'); }

// ===== 登录 =====
function doLogin() {
  var u = document.getElementById('loginUser').value.trim();
  var p = document.getElementById('loginPass').value;
  var err = document.getElementById('loginError');
  if(!u||!p) { err.textContent='请输入用户名和密码'; return; }
  try {
    var hash = sha256(p);
    var user = USERS[u];
    if(!user || user.pwd !== hash) { err.textContent='用户名或密码错误'; return; }
    LOGIN_USER = {username:u, name:user.name, role:user.role};
    localStorage.setItem(TOKEN_KEY, JSON.stringify({u:u, h:hash}));
    showApp(user);
  } catch(e) { err.textContent='登录出错，请重试'; }
}

function showApp(user) {
  document.getElementById('loginWrap').style.display='none';
  document.getElementById('appWrap').style.display='block';
  document.getElementById('headerAvatar').textContent = user.name[0];
  document.getElementById('headerUserName').textContent = user.name;
  document.getElementById('headerUserRole').textContent = user.role==='admin'?'管理员':'普通用户';
  updateStats();
  updateFilters();
  render();
  refreshLogPanel();
  // 管理员首次登录提示设置Token
  if(user.role === 'admin' && !GH_TOKEN) {
    setTimeout(function() { showTokenSetup(); }, 500);
  }
}

function showTokenSetup() {
  var token = prompt('请输入 GitHub Token 以启用云端数据同步：\n\n（可在 GitHub Settings > Developer settings > Personal access tokens 生成，需要 repo 权限）\n\n留空则仅使用本地存储。', GH_TOKEN || '');
  if(token !== null) {
    if(token.trim()) {
      GH_TOKEN = token.trim();
      localStorage.setItem(GH_TOKEN_KEY, GH_TOKEN);
      // 重新加载数据
      location.reload();
    }
  }
}

function doLogout() {
  LOGIN_USER = null;
  localStorage.removeItem(TOKEN_KEY);
  document.getElementById('loginWrap').style.display='flex';
  document.getElementById('appWrap').style.display='none';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
}

document.getElementById('loginPass').addEventListener('keydown', function(e) { if(e.key==='Enter') doLogin(); });
document.getElementById('loginUser').addEventListener('keydown', function(e) { if(e.key==='Enter') doLogin(); });

// 自动登录
(function() {
  var saved = localStorage.getItem(TOKEN_KEY);
  if(!saved) return;
  try {
    var s = JSON.parse(saved);
    var user = USERS[s.u];
    if(user && user.pwd === s.h) {
      LOGIN_USER = {username:s.u, name:user.name, role:user.role};
      showApp(user);
    }
  } catch(e) {}
})();

// ===== 统计指标卡 =====
function updateStats() {
  var d = DATA;
  var pp = {}; var depts = {}; var idle = 0; var catCounts = {};
  d.forEach(function(r) {
    var p = r['公用个人']||'未知'; pp[p] = (pp[p]||0)+1;
    var dept = r['所属部门']||'未分配';
    var mainDept = dept.split('-')[0];
    if(!mainDept) mainDept = '未分配';
    depts[mainDept] = (depts[mainDept]||0)+1;
    var pos = r['当前位置']||''; var person = r['责任人']||'';
    if(['空闲','备用','库存','闲置','未分配'].some(function(k){return pos.includes(k);}) || !person) idle++;
    var cat = r['分类']||'其他';
    if(cat==='sruface') cat='Surface';
    catCounts[cat] = (catCounts[cat]||0)+1;
  });

  var used = d.length - idle;
  var onlineRate = d.length > 0 ? Math.round(used/d.length*1000)/10 : 0;

  var html = '';
  // 4 Metric Cards (design spec)
  // 按数量排序分类
  var catList = [];
  Object.keys(catCounts).forEach(function(k){ catList.push(k+catCounts[k]); });
  var catSub = catList.join(' + ');
  html += '<div class="metric-card" onclick="filterByCard(\'clear\')"><div class="metric-label"><span class="metric-dot blue"></span>电脑总数</div><div class="metric-value">'+d.length+'<span class="metric-unit">台</span></div><div class="metric-sub">含'+catSub+'</div></div>';
  html += '<div class="metric-card" onclick="filterByCard(\'used\')"><div class="metric-label"><span class="metric-dot green"></span>使用率</div><div class="metric-value">'+onlineRate+'<span class="metric-unit">%</span></div><div class="metric-sub">已用 '+used+' 台 / 共 '+d.length+' 台</div></div>';
  html += '<div class="metric-card" onclick="filterByCard(\'idle\')"><div class="metric-label"><span class="metric-dot amber"></span>空闲电脑</div><div class="metric-value">'+idle+'<span class="metric-unit">台</span></div><div class="metric-sub">待分配或闲置设备</div></div>';
  var old5 = d.filter(function(r){return calcYears(r) > 5;}).length;
  var old10 = d.filter(function(r){return calcYears(r) > 10;}).length;
  html += '<div class="metric-card" onclick="filterByCard(\'old\')"><div class="metric-label"><span class="metric-dot red"></span>超年限电脑</div><div class="metric-value">'+old5+'<span class="metric-unit">台</span></div><div class="metric-sub">超5年 '+old5+' 台 / 超10年 '+old10+' 台</div></div>';
  document.getElementById('metricsRow').innerHTML = html;

  // 部门分布卡片 (在section-card中)
  var deptSection = document.getElementById('deptSection');
  if(deptSection) {
    var deptItems = [];
    Object.keys(depts).forEach(function(k){ if(k !== '未分配') deptItems.push({name:k, count:depts[k]}); });
    deptItems.sort(function(a,b){return b.count - a.count;});
    var deptColors = ['#378ADD','#97C459','#EF9F27','#E24B4A','#185FA5','#3B6D11','#854F0B','#0C447C'];
    deptSection.innerHTML = '<div class="dept-tags-grid">'+deptItems.map(function(di, idx){
      var color = deptColors[idx % deptColors.length];
      return '<div class="dept-tag-card" onclick="filterByCard(\'dept_'+di.name+'\')"><span class="dept-color-dot" style="background:'+color+'"></span><span class="dept-name">'+di.name+'</span><span class="dept-count">'+di.count+'</span></div>';
    }).join('')+'</div>';
  }
}

// ===== 筛选器 =====
function updateFilters() {
  var cats = []; var depts = []; var oss = [];
  DATA.forEach(function(r) { if(r['分类'] && cats.indexOf(r['分类'])<0) cats.push(r['分类']); if(r['所属部门'] && depts.indexOf(r['所属部门'])<0) depts.push(r['所属部门']); if(r['操作系统'] && oss.indexOf(r['操作系统'])<0) oss.push(r['操作系统']); });
  cats.sort(); depts.sort(); oss.sort();
  document.getElementById('filterCategory').innerHTML = '<option value="">全部分类</option>'+cats.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');
  document.getElementById('filterDepartment').innerHTML = '<option value="">全部部门</option>'+depts.map(function(d){return '<option value="'+d+'">'+d+'</option>';}).join('');
  document.getElementById('filterOS').innerHTML = '<option value="">全部系统</option>'+oss.map(function(o){return '<option value="'+o+'">'+o+'</option>';}).join('');
  document.getElementById('deptList').innerHTML = depts.map(function(d){return '<option value="'+d+'">';}).join('');
}

// ===== 数据过滤 =====
function getFilteredData() {
  var search = document.getElementById('searchInput').value.toLowerCase();
  var cat = document.getElementById('filterCategory').value;
  var dept = document.getElementById('filterDepartment').value;
  var ppv = document.getElementById('filterPublic').value;
  var osv = document.getElementById('filterOS').value;
  var filtered = DATA.slice();
  if(filterMode === 'idle') filtered = filtered.filter(function(r) { var pos = r['当前位置']||''; var person = r['责任人']||''; return ['空闲','备用','库存','闲置','未分配'].some(function(k){return pos.includes(k);}) || !person; });
  else if(filterMode === 'used') filtered = filtered.filter(function(r) { var pos = r['当前位置']||''; var person = r['责任人']||''; return !(['空闲','备用','库存','闲置','未分配'].some(function(k){return pos.includes(k);}) || !person); });
  else if(filterMode === 'old') filtered = filtered.filter(function(r) { return calcYears(r) > 5; });
  if(search) filtered = filtered.filter(function(r){return FIELDS.some(function(f){return String(r[f]||'').toLowerCase().includes(search);});});
  if(cat) filtered = filtered.filter(function(r){return r['分类']===cat;});
  if(dept) filtered = filtered.filter(function(r){return (r['所属部门']||'').includes(dept);});
  if(ppv) filtered = filtered.filter(function(r){return r['公用个人']===ppv;});
  if(osv) filtered = filtered.filter(function(r){return (r['操作系统']||'')===osv;});
  if(sortField) {
    filtered.sort(function(a, b) {
      var va = (a[sortField] || '').toString();
      var vb = (b[sortField] || '').toString();
      var na = parseFloat(va), nb = parseFloat(vb);
      if(!isNaN(na) && !isNaN(nb) && va === String(na) && vb === String(nb)) { return (na - nb) * sortDir; }
      return va.localeCompare(vb, 'zh-CN') * sortDir;
    });
  }
  return filtered;
}

function calcYears(r) {
  var py = r['采购日期']||'';
  if(!py || py === '/') return 0;
  var year = parseInt(py);
  if(isNaN(year)) return 0;
  return new Date().getFullYear() - year;
}

// ===== 渲染表格 =====
function render() {
  var filtered = getFilteredData();
  var total = filtered.length;
  var totalPages = Math.max(1, Math.ceil(total/pageSize));
  if(currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage-1)*pageSize;
  var page = filtered.slice(start, start+pageSize);
  var isAdmin = LOGIN_USER && LOGIN_USER.role === 'admin';

  function thSort(field, label, width) {
    var arrow = '';
    if(sortField === field) arrow = sortDir === 1 ? ' ▲' : ' ▼';
    return '<th style="width:'+width+'" onclick="toggleSort(\''+field+'\')" tabindex="0" role="columnheader" aria-sort="'+(sortField===field?(sortDir===1?'ascending':'descending'):'none')+'">'+label+'<span style="font-size:10px">'+arrow+'</span></th>';
  }

  document.getElementById('tableWrapper').innerHTML = '<table role="grid" aria-label="电脑资产明细列表"><thead><tr>'+
    thSort('当前位置','当前位置','140px')+
    thSort('公用个人','公用/个人','70px')+
    thSort('责任人','责任人','70px')+
    thSort('资产编号','资产编号','100px')+
    thSort('用户名','用户名','70px')+
    thSort('MAC地址','MAC地址','120px')+
    thSort('是否加域','加域','50px')+
    thSort('IP地址','IP地址','110px')+
    thSort('所属部门','部门','90px')+
    thSort('采购日期','采购日期','70px')+
    thSort('使用年限','使用年限','70px')+
    thSort('本地账号','本地账号','70px')+
    thSort('分类','分类','70px')+
    thSort('CPU','CPU','100px')+
    thSort('内存','内存','60px')+
    thSort('硬盘','硬盘','60px')+
    thSort('操作系统','操作系统','110px')+
    thSort('备注','备注','100px')+
    '<th style="width:80px">操作</th>'+
    '</tr></thead><tbody>'+
    page.map(function(r) {
      var isPersonal = r['公用个人']==='个人';
      var ppBadge = isPersonal ? 'status-badge pending' : 'status-badge active';
      var ppLabel = r['公用个人']==='个人'?'个人':'公用';
      var pos = r['当前位置']||'';
      var deptName = r['所属部门']||'';
      var years = calcYears(r);
      var cat = r['分类']||'';
      var catCls = cat==='台式'?'desktop':cat==='笔记本'?'laptop':cat==='一体机'?'aio':'surface';
      var catLabel = cat==='sruface'?'Surface':cat||'-';
      var domain = r['是否加域']==='是'?'active':'pending';
      var domainLabel = r['是否加域']==='是'?'是':'否';
      var ops = '<button class="btn-icon" onclick="editDevice(\''+r['序号']+'\')" title="编辑" aria-label="编辑">✏</button>';
      if(isAdmin) ops += '<button class="btn-icon danger" onclick="confirmDelete(\''+r['序号']+'\')" title="删除" aria-label="删除">🗑</button>';
      return '<tr>'+
        '<td title="'+pos+'" style="overflow:hidden;text-overflow:ellipsis">'+pos+'</td>'+
        '<td><span class="status-badge '+(isPersonal?'pending':'active')+'">'+ppLabel+'</span></td>'+
        '<td>'+(r['责任人']||'<span style="color:var(--neutral-400)">--</span>')+'</td>'+
        '<td class="mono" style="font-size:12px"><strong>'+(r['资产编号']||'')+'</strong></td>'+
        '<td>'+(r['用户名']||'')+'</td>'+
        '<td class="mono" style="font-size:11px">'+(r['MAC地址']||'')+'</td>'+
        '<td><span class="status-badge '+(r['是否加域']==='是'?'active':'pending')+'">'+domainLabel+'</span></td>'+
        '<td class="mono" style="font-size:11px">'+(r['IP地址']||'')+'</td>'+
        '<td><span class="dept-tag" title="'+deptName+'">'+deptName.substring(0,8)+(deptName.length>8?'…':'')+'</span></td>'+
        '<td class="mono" style="font-size:11px">'+(r['采购日期']||'')+'</td>'+
        '<td class="mono'+(years>5?' years-old':'')+'">'+years+'年</td>'+
        '<td>'+(r['本地账号']||'')+'</td>'+
        '<td><span class="cat-badge '+catCls+'">'+catLabel+'</span></td>'+
        '<td>'+(r['CPU']||'')+'</td>'+
        '<td>'+(r['内存']||'')+'</td>'+
        '<td>'+(r['硬盘']||'')+'</td>'+
        '<td>'+(r['操作系统']||'')+'</td>'+
        '<td style="max-width:100px;overflow:hidden;text-overflow:ellipsis" title="'+(r['备注']||'')+'">'+(r['备注']||'')+'</td>'+
        '<td style="white-space:nowrap">'+ops+'</td>'+
        '</tr>';
    }).join('')+
    '</tbody></table>';

  // Pagination
  var pag = document.getElementById('pagination');
  var ph = ''; var maxB = 7;
  var s = Math.max(1, currentPage-3), e = Math.min(totalPages, s+maxB-1);
  if(e-s < maxB-1) s = Math.max(1, e-maxB+1);
  ph += '<button '+(currentPage===1?'disabled':'')+' onclick="goPage('+(currentPage-1)+')" aria-label="上一页">◀</button>';
  for(var i=s;i<=e;i++) ph += '<button class="'+(i===currentPage?'active':'')+'" onclick="goPage('+i+')">'+i+'</button>';
  ph += '<button '+(currentPage===totalPages?'disabled':'')+' onclick="goPage('+(currentPage+1)+')" aria-label="下一页">▶</button>';
  pag.innerHTML = '<div class="pagination-info">共 <strong>'+total+'</strong> 台电脑，第 '+currentPage+'/'+totalPages+' 页 &nbsp; 每页 <select onchange="changePageSize(this.value)">'+
    '<option value="50"'+(pageSize===50?' selected':'')+'>50条</option>'+
    '<option value="100"'+(pageSize===100?' selected':'')+'>100条</option>'+
    '<option value="200"'+(pageSize===200?' selected':'')+'>200条</option>'+
    '<option value="500"'+(pageSize===500?' selected':'')+'>500条</option>'+
    '</select></div><div class="pagination-btns">'+ph+'</div>';
}

function toggleSort(field) {
  if(sortField === field) { sortDir = -sortDir; }
  else { sortField = field; sortDir = 1; }
  currentPage = 1;
  render();
}

function changePageSize(size) { pageSize = parseInt(size); currentPage = 1; render(); }
function goPage(p) { if(p>=1 && p<=Math.ceil(getFilteredData().length/pageSize)){ currentPage=p; render(); } }
function reload() { currentPage=1; render(); }
function debounceSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(function(){ currentPage=1; render(); }, 300); }

function filterByCard(action) {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterDepartment').value = '';
  document.getElementById('filterPublic').value = '';
  document.getElementById('filterOS').value = '';
  filterMode = (action === 'clear') ? '' : action;
  if(action.indexOf('dept_') === 0) {
    filterMode = '';
    document.getElementById('searchInput').value = action.substring(5);
  }
  currentPage = 1;
  render();
}

// ===== CRUD =====
function openModal(id) {
  if(!LOGIN_USER) { showToast('请先登录', 'error'); return; }
  editingId = id || null;
  document.getElementById('modalTitle').textContent = id ? '编辑电脑 #'+id : '新增电脑';
  document.getElementById('editForm').reset();
  if(id) {
    var r = DATA.find(function(d){return d['序号']===id;});
    if(r) {
      var form = document.getElementById('editForm');
      FIELDS.forEach(function(f){ var el = form.querySelector('[name="'+f+'"]'); if(el && r[f]!==undefined) el.value = r[f]; });
    }
  }
  document.getElementById('editModal').classList.add('active');
}

function editDevice(id) { openModal(id); }
function closeModal() { document.getElementById('editModal').classList.remove('active'); }

function saveDevice() {
  var form = document.getElementById('editForm');
  var fd = new FormData(form);
  var obj = {};
  FIELDS.forEach(function(f){ obj[f] = fd.get(f) || ''; });
  if(editingId) {
    var idx = DATA.findIndex(function(d){return d['序号']===editingId;});
    if(idx >= 0) {
      var old = DATA[idx];
      // 记录变更字段
      var changes = [];
      FIELDS.forEach(function(f) {
        var ov = (old[f]||'').toString();
        var nv = (obj[f]||'').toString();
        if(ov !== nv && f !== '序号') changes.push(f + ': ' + ov + ' → ' + nv);
      });
      var merged = {}; Object.keys(DATA[idx]).forEach(function(k){merged[k]=DATA[idx][k];}); Object.keys(obj).forEach(function(k){merged[k]=obj[k];}); merged['序号']=editingId;
      DATA[idx] = merged;
      var detail = changes.length > 0 ? changes.join('; ') : '无变更';
      addOpLog('编辑', '#'+editingId+' '+(obj['资产编号']||'')+' ('+(obj['当前位置']||'')+')', detail);
    }
  } else {
    var maxId = Math.max.apply(null, [0].concat(DATA.map(function(d){return parseInt(d['序号'])||0;})));
    obj['序号'] = String(maxId + 1);
    DATA.push(obj);
    addOpLog('新增', '#'+obj['序号']+' '+(obj['资产编号']||'')+' ('+(obj['当前位置']||'')+')', obj['分类']+' - IP:'+(obj['IP地址']||'无'));
  }
  closeModal();
  updateStats();
  render();
  saveDataToStorage();
  showToast(editingId ? '电脑更新成功' : '电脑添加成功', 'success');
}

function confirmDelete(id) {
  if(!LOGIN_USER || LOGIN_USER.role !== 'admin') { showToast('仅管理员可删除', 'error'); return; }
  var del = DATA.find(function(d){return d['序号']===id;});
  document.getElementById('confirmMsg').textContent = '确认删除 #'+id+' '+(del?del['资产编号']:'')+' ('+(del?del['当前位置']:'')+')？';
  document.getElementById('confirmDialog').classList.add('active');
  confirmCb = function() {
    var del = DATA.find(function(d){return d['序号']===id;});
    DATA = DATA.filter(function(d){return d['序号']!==id;});
    addOpLog('删除', '#'+id+' '+(del?del['资产编号']:'')+' ('+(del?del['当前位置']:'')+')', 'IP:'+(del?del['IP地址']:'无')+' | '+del['分类']);
    updateStats();
    render();
    saveDataToStorage();
    showToast('已删除', 'success');
  };
}

function closeConfirm() { document.getElementById('confirmDialog').classList.remove('active'); confirmCb = null; }
function executeConfirm() { if(confirmCb){ confirmCb(); closeConfirm(); } }

// ===== 导出/导入 =====
function exportCSV() {
  var filtered = getFilteredData();
  var csv = '\uFEFF' + FIELDS.join(',') + '\n';
  filtered.forEach(function(r){
    csv += FIELDS.map(function(f){ var v = String(r[f]||''); if(v.includes(',')||v.includes('"')||v.includes('\n')) v = '"'+v.replace(/"/g,'""')+'"'; return v; }).join(',')+'\n';
  });
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '电脑台账_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  addOpLog('导出', filtered.length+'条记录', '');
  showToast('导出成功', 'success');
}

function importData(input) {
  if(!LOGIN_USER) { showToast('请先登录', 'error'); return; }
  var file = input.files[0];
  if(!file) return;
  var ext = file.name.split('.').pop().toLowerCase();
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var imported;
      if(ext === 'json') { imported = JSON.parse(e.target.result); if(!Array.isArray(imported)) imported = imported.data || []; }
      else {
        var lines = e.target.result.split('\n').filter(Boolean);
        if(lines.length < 2) { showToast('文件格式错误', 'error'); return; }
        var headers = lines[0].replace(/^\uFEFF/,'').split(',');
        imported = lines.slice(1).map(function(line) {
          var vals = [], inQ = false, cur = '';
          for(var ci=0;ci<line.length;ci++) { var ch=line[ci]; if(ch==='"') inQ = !inQ; else if(ch===',' && !inQ) { vals.push(cur); cur = ''; } else cur += ch; }
          vals.push(cur);
          var obj = {}; headers.forEach(function(h,i){ obj[h.trim()] = (vals[i]||'').replace(/^"|"$/g,''); });
          return obj;
        });
      }
      if(imported.length === 0) { showToast('未识别到数据', 'error'); return; }
      document.getElementById('confirmMsg').textContent = '确认导入 '+imported.length+' 条数据？';
      document.getElementById('confirmDialog').classList.add('active');
      confirmCb = function() {
        DATA = imported;
        addOpLog('导入', imported.length+'条记录', '');
        updateStats();
        updateFilters();
        render();
        saveDataToStorage();
        showToast('已导入 '+imported.length+' 条', 'success');
      };
    } catch(err) { showToast('解析失败: '+err.message, 'error'); }
  };
  if(ext === 'json') reader.readAsText(file); else reader.readAsText(file);
  input.value = '';
}

// ===== Toast =====
function showToast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast '+type;
  el.textContent = msg;
  el.setAttribute('role', 'alert');
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(function(){el.remove();},300); }, 2500);
}

// Modal overlay click to close
document.getElementById('editModal').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
document.getElementById('confirmDialog').addEventListener('click', function(e){ if(e.target===this) closeConfirm(); });
document.getElementById('logModal').addEventListener('click', function(e){ if(e.target===this) closeLogPanel(); });
