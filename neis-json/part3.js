  function parseNEIS(html, options={}){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const strictInstitution=!!options.strictInstitution, omitEmpty=!!options.omitEmpty, includeRaw=options.includeRaw!==false;
    const scrub=makeScrubber(doc,strictInstitution);
    const out=JSON.parse(JSON.stringify(EMPTY_SCHEMA));
    out.meta.extracted_at=new Date().toISOString();
    out.meta.source_title=flat(doc.title||'');
    out.meta.privacy.institution_names_redacted=strictInstitution;
    out.academic_history=parseAcademicHistory(doc,scrub);

    let currentSection=null, currentGrade=null, currentGroup='ranked', tableIndex=0;
    const walker=doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    let el;
    while((el=walker.nextNode())){
      if(el.matches?.('h2.sub-tit-b,h2,h3')){
        const sn=sectionNumber(el.textContent); if(sn>=1 && sn<=9) currentSection=sn;
      }
      if(currentSection===7 && el.tagName==='P'){
        const tx=flat(el.textContent), g=parseGradeFromText(tx); if(g){currentGrade=g;currentGroup='ranked';}
        else if(/진로\s*선택\s*과목/.test(tx)) currentGroup='career_elective';
        else if(/체육\s*[·ㆍ∙]\s*예술|체육.*예술/.test(tx)) currentGroup='pe_arts';
      }
      if(el.tagName!=='TABLE') continue;
      const parsed=rowsAsObjects(el,scrub); const cls=classifyTable(el,parsed,currentSection); const idx=tableIndex++;
      if(cls==='personal_class_info') continue;
      if(includeRaw && cls!=='unknown') out.audit.raw_non_personal_tables.push(tableAuditEntry(el,parsed,currentSection,cls,idx));
      if(cls!=='unknown') out.audit.recognized_table_count++;

      const rows=cleanDataRows(parsed.rows,omitEmpty);
      if(cls==='attendance'){
        for(const r of rows){
          const o={}; parsed.headers.forEach((h,i)=>o[h]=r[i]??'');
          const grade=intOrNull(valLike(o,'학년')); if(grade==null && omitEmpty) continue;
          const keys=parsed.headers;
          const pick=(a,b)=>{ const k=keys.find(x=>x.includes(a)&&x.includes(b)); return k?o[k]:''; };
          out.attendance.years.push({grade,school_days:num(valLike(o,'수업일수')),
            absence:{illness:num(pick('결석일수','질병')),unexcused:num(pick('결석일수','미인정')),other:num(pick('결석일수','기타'))},
            tardy:{illness:num(pick('지 각','질병')||pick('지각','질병')),unexcused:num(pick('지 각','미인정')||pick('지각','미인정')),other:num(pick('지 각','기타')||pick('지각','기타'))},
            early_leave:{illness:num(pick('조 퇴','질병')||pick('조퇴','질병')),unexcused:num(pick('조 퇴','미인정')||pick('조퇴','미인정')),other:num(pick('조 퇴','기타')||pick('조퇴','기타'))},
            class_absence:{illness:num(pick('결 과','질병')||pick('결과','질병')),unexcused:num(pick('결 과','미인정')||pick('결과','미인정')),other:num(pick('결 과','기타')||pick('결과','기타'))},
            special_note:nullish(valLike(o,'특기사항'))});
        }
      } else if(cls==='awards'){
        for(const r of rows){ const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); if(!meaningfulRow(r))continue;
          out.awards.push({grade:intOrNull(valLike(o,'학년')),semester:intOrNull(valLike(o,'학기')),name:nullish(valLike(o,'수 상 명')||valLike(o,'수상명')),rank_or_grade:nullish(valLike(o,'등급(위)')),date:nullish(valLike(o,'수상연월일')),awarding_body:nullish(valLike(o,'수여기관')),participants:nullish(valLike(o,'참가대상'))}); }
      } else if(cls==='certifications'){
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); if(!meaningfulRow(r))continue; out.certifications.push({category:nullish(valLike(o,'구분')),name_or_type:nullish(valLike(o,'명칭 또는 종류')),number_or_content:nullish(valLike(o,'번호 또는 내용')),date:nullish(valLike(o,'취득연월일')),issuer:nullish(valLike(o,'발급기관'))});}
      } else if(cls==='national_competency'){
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); if(!meaningfulRow(r))continue; out.national_competency_units.push({grade:intOrNull(valLike(o,'학년')),semester:intOrNull(valLike(o,'학기')),subclassification:nullish(valLike(o,'세분류')),competency_unit:nullish(valLike(o,'능력단위')),hours:num(valLike(o,'이수시간')),raw_score:nullish(valLike(o,'원점수')),achievement:nullish(valLike(o,'성취도')),note:nullish(valLike(o,'비고'))});}
      } else if(cls==='school_violence'){
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); if(!meaningfulRow(r))continue; out.school_violence_measures.push({grade:intOrNull(valLike(o,'학년')),decision_date:nullish(valLike(o,'조치결정 일자')),measure:nullish(valLike(o,'조치사항'))});}
      } else if(cls==='creative'){
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); if(!meaningfulRow(r))continue; const detail=norm(valLike(o,'특기사항')); const cf=[...detail.matchAll(/희망분야\s*:\s*([^\n]+)/g)].map(m=>flat(m[1])); out.creative_experiential_activities.activities.push({grade:intOrNull(valLike(o,'학년')),area:nullish(valLike(o,'영역')),hours:num(valLike(o,'시간')),career_field:cf[0]||null,detail:detail||null,availability:detail.includes('당해학년도 학교생활기록은 제공하지 않습니다.')?'withheld_current_year':'available'});}
      } else if(cls==='volunteer'){
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); if(!meaningfulRow(r))continue; out.creative_experiential_activities.volunteer_service.push({grade:intOrNull(valLike(o,'학년')),date_or_period:nullish(valLike(o,'일자 또는 기간')),place_or_organizer:nullish(valLike(o,'장소 또는 주관기관명')),activity:nullish(valLike(o,'활동내용')),hours:num(valLike(o,'시간')),cumulative_hours:num(valLike(o,'누계시간'))});}
      } else if(cls==='grades'){
        const group=groupByHeaders(parsed.headers)||currentGroup; if(currentGrade==null) currentGrade=0; const y=academicYearNode(out,currentGrade); currentGroup=group;
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); if(!meaningfulRow(r))continue; const scoreRaw=valLike(o,'원점수/과목평균');
          y.course_groups[group].courses.push({semester:intOrNull(valLike(o,'학기')),curriculum_area:nullish(valLike(o,'교과')),subject:nullish(valLike(o,'과목')),credits:intOrNull(valLike(o,'학점수')),score:parseScoreCell(scoreRaw),achievement:parseAchievement(valLike(o,'성취도(수강자수)')||valLike(o,'성취도')),distribution:parseDistribution(valLike(o,'성취도별 분포비율')),rank_grade:intOrNull(valLike(o,'석차등급')),note:nullish(valLike(o,'비고'))}); }
      } else if(cls==='credit_total' && currentGrade!=null){
        const y=academicYearNode(out,currentGrade); const all=parsed.matrix.flat().map(flat); let total=null; for(let i=0;i<all.length;i++) if(all[i].includes('이수학점 합계')){ total=intOrNull(all[i+1]||''); if(total!==null)break; }
        y.course_groups[currentGroup].total_credits=total;
      } else if(cls==='subject_details' && currentGrade!=null){
        const y=academicYearNode(out,currentGrade); const raw=norm(parsed.rows.flat().join('\n')); const subjects=y.course_groups[currentGroup].courses.map(c=>c.subject).filter(Boolean); const split=splitSubjectDetails(raw,subjects);
        y.course_groups[currentGroup].subject_details.push({raw_text:raw,availability:split.availability||'available',entries:split.entries,unparsed_text:split.unparsed_text});
      } else if(cls==='reading'){
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); const txt=norm(valLike(o,'독서 활동 상황')); if(!meaningfulRow(r))continue; if(omitEmpty && !txt) continue; out.reading_activities.push({grade:intOrNull(valLike(o,'학년')),subject_or_area:nullish(valLike(o,'과목 또는 영역')),record:txt||null,has_content:!!txt,availability:txt.includes('당해학년도 학교생활기록은 제공하지 않습니다.')?'withheld_current_year':'available'});}
      } else if(cls==='behavior'){
        for(const r of rows){const o={};parsed.headers.forEach((h,i)=>o[h]=r[i]??''); const txt=norm(valLike(o,'행동특성 및 종합의견')); if(!meaningfulRow(r))continue; if(omitEmpty && !txt) continue; out.behavior_and_overall_comments.push({grade:intOrNull(valLike(o,'학년')),comment:txt||null,availability:txt.includes('당해학년도 학교생활기록은 제공하지 않습니다.')?'withheld_current_year':'available'});}
      } else if(cls==='unknown'){
        if(currentSection && currentSection<=9){
          const entry=tableAuditEntry(el,parsed,currentSection,cls,idx);
          // UI 업로더/전송상태표 등 학생부 본문 바깥의 테이블 제외
          const text=flat(parsed.matrix.flat().join(' '));
          if(!/파 일|전송 용량|남은 시간|속 도/.test(text)) { out.audit.unclassified_tables.push(entry); if(includeRaw) out.audit.raw_non_personal_tables.push(entry); }
        }
      }
    }

    out.academics.years.sort((a,b)=>a.grade-b.grade);
    // 0학년은 문서 구조 변화로 학년 표식을 못 찾은 경우만 발생. audit로 알리고 유지.
    out.audit.warnings=[];
    if(out.academics.years.some(y=>y.grade===0)) out.audit.warnings.push('일부 교과 표의 학년 표식을 자동 판별하지 못했습니다. raw_non_personal_tables를 확인하세요.');
    if(out.audit.unclassified_tables.length) out.audit.warnings.push(`학생부 범위에서 미분류 표 ${out.audit.unclassified_tables.length}개를 발견했습니다.`);
    return out;
  }

