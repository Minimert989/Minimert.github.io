'use strict';
  const $ = id => document.getElementById(id);
  const state = { file:null, lastJson:null };

  const EMPTY_SCHEMA = {
    schema_version: "neis.student_record.v1",
    meta: {
      source_type: "NEIS+ saved HTML",
      extracted_at: "ISO-8601",
      privacy: {
        direct_identifiers_removed: true,
        removed_categories: ["성명","성별","주민등록번호","주소","사진","학반/번호","담임성명"],
        institution_names_redacted: false
      }
    },
    academic_history: { raw_text: "", events: [], special_note: null },
    attendance: { years: [] },
    awards: [],
    certifications: [],
    national_competency_units: [],
    school_violence_measures: [],
    creative_experiential_activities: { activities: [], volunteer_service: [] },
    academics: { years: [] },
    reading_activities: [],
    behavior_and_overall_comments: [],
    other_non_personal_records: [],
    audit: { recognized_table_count: 0, unclassified_tables: [], raw_non_personal_tables: [] }
  };
  $('schemaPreview').textContent = JSON.stringify(EMPTY_SCHEMA, null, 2);

  function norm(s){
    return (s ?? '').replace(/[\u2000-\u200b\u00a0]/g,' ').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function flat(s){ return norm(s).replace(/\n+/g,' ').replace(/\s{2,}/g,' ').trim(); }
  function nullish(s){ const x=flat(s); return !x || x==='·' ? null : x; }
  function num(s){ const x=flat(s); if(!x || x==='.' || x==='·') return 0; const n=Number(x.replace(/,/g,'')); return Number.isFinite(n)?n:null; }
  function intOrNull(s){ const x=flat(s); if(!x || x==='.' || x==='·') return null; const n=parseInt(x.replace(/[^0-9-]/g,''),10); return Number.isFinite(n)?n:null; }
  function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
  function cssEscape(s){ return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  function preferredText(el){
    if(!el) return '';
    const pc = el.querySelector(':scope > .pcView, :scope .pcView');
    if(pc && norm(pc.textContent)) return norm(pc.textContent);
    const mobile = el.querySelector(':scope > .mobileView, :scope .mobileView');
    if(mobile && norm(mobile.textContent)) return norm(mobile.textContent);
    return norm(el.textContent);
  }

  function getSensitiveContext(doc){
    const labels = [/^성명$/, /^성별$/, /주민등록번호/, /^주소$/, /전화번호|휴대전화|연락처|이메일/];
    const values = [];
    for(const vc of doc.querySelectorAll('.view-col')){
      const head = vc.querySelector('h5,h4,h3,.th');
      const label = flat(head?.textContent||'');
      if(!labels.some(r=>r.test(label))) continue;
      const td = vc.querySelector('.td');
      let v = preferredText(td);
      if(v) values.push({label, value:v});
    }
    return values;
  }

  function makeScrubber(doc, strictInstitution){
    const sensitive = getSensitiveContext(doc);
    const exact = [];
    for(const x of sensitive){
      if(x.value.length>=2) exact.push(x.value);
      if(x.label==='주소'){
        // PC/mobile duplicate가 붙은 경우에도 개별 주소를 잡기 위한 보조 분리
        const half = x.value.length%2===0 ? x.value.slice(0,x.value.length/2) : '';
        if(half && x.value===half+half) exact.push(half);
      }
    }
    const studentName = sensitive.find(x=>x.label==='성명')?.value;
    if(studentName) exact.push(studentName);
    return function scrub(input){
      let s = norm(input);
      for(const v of unique(exact).sort((a,b)=>b.length-a.length)) s = s.split(v).join('[개인정보]');
      s = s
        .replace(/\b\d{6}\s*-\s*[0-9*]{7}\b/g,'[주민등록번호]')
        .replace(/\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g,'[전화번호]')
        .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,'[이메일]');
      if(strictInstitution){
        // 교육기관/기관명은 평가정보 보존을 위해 기본 유지. 엄격 모드에서만 익명화.
        s = s.replace(/[가-힣A-Za-z0-9·\s()]+(?:초등학교|중학교|고등학교|대학교|학교장|교육청|교육원|연구원|센터|기관)/g, m => m.trim().length>1 ? '[기관]' : m);
      }
      return norm(s);
    };
  }

  function tableGrid(table, scrub){
    const trs=[...table.querySelectorAll('tr')];
    const grid=[]; const meta=[];
    for(let r=0;r<trs.length;r++){
      if(!grid[r]) grid[r]=[];
      if(!meta[r]) meta[r]=[];
      let c=0;
      for(const cell of [...trs[r].children].filter(x=>/^(TH|TD)$/.test(x.tagName))){
        while(grid[r][c]!==undefined) c++;
        const rs=Math.max(1,parseInt(cell.getAttribute('rowspan')||'1',10));
        const cs=Math.max(1,parseInt(cell.getAttribute('colspan')||'1',10));
        const text=scrub(preferredText(cell));
        for(let rr=0;rr<rs;rr++){
          if(!grid[r+rr]) grid[r+rr]=[];
          if(!meta[r+rr]) meta[r+rr]=[];
          for(let cc=0;cc<cs;cc++){
            grid[r+rr][c+cc]=text;
            meta[r+rr][c+cc]={tag:cell.tagName, originRow:r, originCol:c};
          }
        }
        c+=cs;
      }
    }
    const w=Math.max(0,...grid.map(r=>r.length));
    for(const r of grid) for(let i=0;i<w;i++) if(r[i]===undefined) r[i]='';
    return {grid, meta, width:w};
  }

  function headerInfo(table, tg){
    const trs=[...table.querySelectorAll('tr')];
    let headerRows=0;
    for(const tr of trs){
      const cells=[...tr.children].filter(x=>/^(TH|TD)$/.test(x.tagName));
      if(cells.length && cells.every(x=>x.tagName==='TH')) headerRows++; else break;
    }
    if(table.tHead) headerRows=Math.max(headerRows, table.tHead.rows.length);
    if(headerRows===0 && trs[0]?.querySelector('th')) headerRows=1;
    const headers=[];
    for(let c=0;c<tg.width;c++){
      const parts=[];
      for(let r=0;r<headerRows;r++){
        const v=flat(tg.grid[r]?.[c]||'');
        if(v && parts[parts.length-1]!==v) parts.push(v);
      }
      headers.push(parts.join(' / '));
    }
    return {headerRows,headers};
  }

  function rowsAsObjects(table, scrub){
    const tg=tableGrid(table,scrub), hi=headerInfo(table,tg);
    const rows=tg.grid.slice(hi.headerRows);
    const objects=rows.map(row=>{
      const o={}; hi.headers.forEach((h,i)=>{ o[h||`col_${i+1}`]=row[i]??''; }); return o;
    });
    return {matrix:tg.grid,headers:hi.headers,headerRows:hi.headerRows,rows,objects};
  }

  function hasHeader(headers, needle){ return headers.some(h=>flat(h).includes(needle)); }
  function keyLike(obj, needle){ return Object.keys(obj).find(k=>flat(k).includes(needle)); }
  function valLike(obj, needle){ const k=keyLike(obj,needle); return k ? obj[k] : ''; }
  function meaningfulRow(row){ return row.some(x=>flat(x)); }
  function cleanDataRows(rows, omitEmpty){ return omitEmpty ? rows.filter(meaningfulRow) : rows; }
  function parseGradeFromText(x){ const m=flat(x).match(/^(\d)학년$/); return m?Number(m[1]):null; }
  function sectionNumber(x){ const m=flat(x).match(/^(\d)\./); return m?Number(m[1]):null; }
