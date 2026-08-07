  function academicYearNode(out, grade){
    let y=out.academics.years.find(x=>x.grade===grade);
    if(!y){ y={grade, course_groups:{ranked:{courses:[],total_credits:null,subject_details:[]},career_elective:{courses:[],total_credits:null,subject_details:[]},pe_arts:{courses:[],total_credits:null,subject_details:[]}}}; out.academics.years.push(y); }
    return y;
  }
  function groupByHeaders(headers){
    if(hasHeader(headers,'석차등급')) return 'ranked';
    if(hasHeader(headers,'성취도별 분포비율')) return 'career_elective';
    if(hasHeader(headers,'학점수') && hasHeader(headers,'성취도')) return 'pe_arts';
    return null;
  }

  function parseScoreCell(raw){
    const s=flat(raw); if(!s||s==='·') return {raw:null,score:null,mean:null,stddev:null};
    let m=s.match(/^([0-9.]+)\/([0-9.]+)\(([0-9.]+)\)$/);
    if(m) return {raw:s,score:Number(m[1]),mean:Number(m[2]),stddev:Number(m[3])};
    m=s.match(/^([0-9.]+)\/([0-9.]+)$/);
    if(m) return {raw:s,score:Number(m[1]),mean:Number(m[2]),stddev:null};
    return {raw:s,score:null,mean:null,stddev:null};
  }
  function parseAchievement(raw){
    const s=flat(raw); if(!s||s==='·') return {raw:null,level:null,enrollment:null};
    const m=s.match(/^([^()]+?)(?:\((\d+)\))?$/); return {raw:s,level:m?m[1].trim():s,enrollment:m&&m[2]?Number(m[2]):null};
  }
  function parseDistribution(raw){
    const s=flat(raw); const o={raw:null,levels:{}}; if(!s||s==='·') return o; o.raw=s;
    for(const m of s.matchAll(/([^\s()]+)\(([0-9.]+)\)/g)) o.levels[m[1]]=Number(m[2]); return o;
  }

  function splitSubjectDetails(raw, subjects){
    const text=norm(raw);
    if(!text) return {entries:[],unparsed_text:null};
    if(text.includes('당해학년도 학교생활기록은 제공하지 않습니다.')) return {entries:[],unparsed_text:text,availability:'withheld_current_year'};
    const matches=[];
    for(const subject of [...subjects].sort((a,b)=>b.length-a.length)){
      if(!subject) continue;
      const esc=cssEscape(subject).replace(/\\ /g,'\\s*');
      const re=new RegExp(`(?:\\((1|2)학기\\))?\\s*${esc}\\s*:`, 'g');
      let m; while((m=re.exec(text))!==null) matches.push({idx:m.index,end:re.lastIndex,semester:m[1]?Number(m[1]):null,subject});
    }
    matches.sort((a,b)=>a.idx-b.idx || b.end-a.end);
    const ded=[]; let last=-1;
    for(const m of matches){ if(m.idx===last) continue; ded.push(m); last=m.idx; }
    const entries=[];
    for(let i=0;i<ded.length;i++){
      const m=ded[i], end=i+1<ded.length?ded[i+1].idx:text.length;
      entries.push({subject:m.subject,semester:m.semester,text:norm(text.slice(m.end,end))});
    }
    const prefix=ded.length?norm(text.slice(0,ded[0].idx)):text;
    return {entries,unparsed_text:prefix||null,availability:'available'};
  }

  function parseAcademicHistory(doc,scrub){
    let raw='';
    for(const vc of doc.querySelectorAll('.view-col')){
      const label=flat(vc.querySelector('h5,h4,h3,.th')?.textContent||'');
      if(label==='학적사항') { raw=scrub(preferredText(vc.querySelector('.td'))); break; }
    }
    // PC/mobile 중복 방지: 동일한 두 절반이 붙은 경우 절반만 사용
    if(raw.length%2===0){ const h=raw.slice(0,raw.length/2); if(h && raw===h+h) raw=h; }
    const events=[];
    for(const line of raw.split(/\n+/).map(flat).filter(Boolean)){
      const m=line.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s+(.+?)\s+(제?\d학년\s+)?(입학|졸업|전학|전입|전출|편입학|재입학|자퇴|퇴학|유급|수료|진급)(.*)$/);
      if(m){ events.push({date:`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`,institution:nullish(m[4]),grade_text:nullish(m[5]),event:m[6],note:nullish(m[7])}); }
      else events.push({raw:line});
    }
    let specialNote=null;
    for(const vc of doc.querySelectorAll('.view-col')){
      const label=flat(vc.querySelector('h5,h4,h3,.th')?.textContent||'');
      if(label==='특기사항'){ const v=scrub(preferredText(vc.querySelector('.td'))); specialNote=v||null; break; }
    }
    return {raw_text:raw,events,special_note:specialNote};
  }

  function classifyTable(t, parsed, section){
    const h=parsed.headers.map(flat);
    if(h.some(x=>x.includes('담임성명')) && h.some(x=>x==='반')) return 'personal_class_info';
    if(hasHeader(h,'수업일수') && hasHeader(h,'결석일수')) return 'attendance';
    if(hasHeader(h,'수 상 명') || hasHeader(h,'수상명')) return 'awards';
    if(hasHeader(h,'명칭 또는 종류') && hasHeader(h,'취득연월일')) return 'certifications';
    if(hasHeader(h,'능력단위') && hasHeader(h,'이수시간')) return 'national_competency';
    if(hasHeader(h,'조치결정 일자') && hasHeader(h,'조치사항')) return 'school_violence';
    if(section===6 && hasHeader(h,'영역') && hasHeader(h,'특기사항')) return 'creative';
    if(section===6 && hasHeader(h,'일자 또는 기간') && hasHeader(h,'누계시간')) return 'volunteer';
    if(section===7 && hasHeader(h,'세부능력 및 특기사항')) return 'subject_details';
    if(section===7 && hasHeader(h,'학기') && hasHeader(h,'과목') && hasHeader(h,'학점수')) return 'grades';
    if(section===7 && parsed.matrix.flat().some(x=>flat(x).includes('이수학점 합계'))) return 'credit_total';
    if(hasHeader(h,'과목 또는 영역') && hasHeader(h,'독서 활동 상황')) return 'reading';
    if(hasHeader(h,'행동특성 및 종합의견')) return 'behavior';
    return 'unknown';
  }

  function tableAuditEntry(table,parsed,section,classification,index){
    return {table_index:index,section,classification,headers:parsed.headers,matrix:parsed.matrix};
  }

