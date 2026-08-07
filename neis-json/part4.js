  async function convert(){
    if(!state.file){ setStatus('HTML 파일을 먼저 선택하세요.',false); return; }
    try{
      setStatus('파일을 읽고 있습니다…');
      const html=await state.file.text();
      const json=parseNEIS(html,{includeRaw:$('includeRaw').checked,strictInstitution:$('strictInstitution').checked,omitEmpty:$('omitEmpty').checked});
      state.lastJson=json; $('output').value=JSON.stringify(json,null,2);
      const grades=json.academics.years.map(y=>y.grade).filter(Boolean).join(', ');
      const courseCount=json.academics.years.reduce((n,y)=>n+Object.values(y.course_groups).reduce((m,g)=>m+g.courses.length,0),0);
      setStatus(`변환 완료: 출결 ${json.attendance.years.length}개 학년 · 수상 ${json.awards.length}건 · 창체 ${json.creative_experiential_activities.activities.length}건 · 봉사 ${json.creative_experiential_activities.volunteer_service.length}건 · 교과 ${courseCount}건 · 행특 ${json.behavior_and_overall_comments.length}개 학년`,true);
      $('diag').textContent=`교과 학년: ${grades||'판별 없음'} / 인식 표: ${json.audit.recognized_table_count} / 미분류 표: ${json.audit.unclassified_tables.length} / 개인정보 원문은 출력하지 않음`;
    }catch(e){ console.error(e); setStatus(`변환 실패: ${e.message}`,false,true); }
  }
  function setStatus(msg,ok=false,err=false){ const el=$('status');el.textContent=msg;el.className='status'+(ok?' ok':err?' err':''); }
  async function copy(){ if(!$('output').value)return; await navigator.clipboard.writeText($('output').value); setStatus('JSON을 클립보드에 복사했습니다.',true); }
  function download(){ if(!$('output').value)return; const blob=new Blob([$('output').value],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(state.file?.name||'neis').replace(/\.(html?|HTML?)$/,'')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  function acceptFile(f){ if(!f)return; state.file=f; setStatus(`선택됨: ${f.name}`); }

  $('fileInput').addEventListener('change',e=>acceptFile(e.target.files[0]));
  $('convertBtn').addEventListener('click',convert); $('copyBtn').addEventListener('click',copy); $('downloadBtn').addEventListener('click',download);
  $('schemaBtn').addEventListener('click',()=>{$('output').value=JSON.stringify(EMPTY_SCHEMA,null,2);});
  const dz=$('dropZone'); ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')})); ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')})); dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];acceptFile(f);$('fileInput').files=e.dataTransfer.files;});

  // 자동화 테스트/재사용을 위한 공개 API
  window.NEISParser={parse:parseNEIS,emptySchema:EMPTY_SCHEMA};
