'use strict';

/**
 * 전국 숙박 객단가 모니터링 — 지역 코드 마스터
 *
 * 야놀자(NOL) 공식 API `/display/api/sub-home/local-regions?type=TYPE` 에서 추출한 코드
 * 여기어때(yeogi.com) 키워드 검색 방식
 *
 * accommodationType: 'motel' | 'hotel' | 'pension' | 'guesthouse'
 * yanoljaRegion:     NOL /local/list?type=TYPE&region=CODE 의 CODE
 * yeogiKeyword:      yeogi.com 검색어 (시/구/동 명)
 */

const REGIONS_BY_TYPE = {
  // ═══════════════════════════════════════════════════════════
  // 모텔 — 주요 광역시·도시 생활권 중심
  // ═══════════════════════════════════════════════════════════
  motel: [
    // 서울
    { city: '서울', district: '강남/역삼/삼성/논현',      yanoljaRegion: '900393', yeogiKeyword: '강남구' },
    { city: '서울', district: '서초/신사/방배',             yanoljaRegion: '900394', yeogiKeyword: '서초구' },
    { city: '서울', district: '잠실/방이',                  yanoljaRegion: '910285', yeogiKeyword: '송파구' },
    { city: '서울', district: '잠실새내/신천/종합운동장',   yanoljaRegion: '910286', yeogiKeyword: '송파구 신천' },
    { city: '서울', district: '영등포/여의도',              yanoljaRegion: '910023', yeogiKeyword: '영등포구' },
    { city: '서울', district: '신림/서울대/사당/동작',      yanoljaRegion: '910022', yeogiKeyword: '동작구' },
    { city: '서울', district: '천호/길동/둔촌',             yanoljaRegion: '900396', yeogiKeyword: '강동구' },
    { city: '서울', district: '화곡/까치산/양천/목동',      yanoljaRegion: '910017', yeogiKeyword: '양천구' },
    { city: '서울', district: '구로/금천/오류/신도림',      yanoljaRegion: '910024', yeogiKeyword: '구로구' },
    { city: '서울', district: '신촌/홍대/합정',             yanoljaRegion: '900400', yeogiKeyword: '마포구' },
    { city: '서울', district: '연신내/불광/응암',           yanoljaRegion: '900401', yeogiKeyword: '은평구' },
    { city: '서울', district: '종로/대학로/동묘앞역',       yanoljaRegion: '910191', yeogiKeyword: '종로구' },
    { city: '서울', district: '성신여대/성북/월곡',         yanoljaRegion: '900403', yeogiKeyword: '성북구' },
    { city: '서울', district: '이태원/용산/서울역/명동',    yanoljaRegion: '910193', yeogiKeyword: '용산구' },
    { city: '서울', district: '동대문/을지로/충무로/신당',  yanoljaRegion: '910192', yeogiKeyword: '동대문구' },
    { city: '서울', district: '회기/고려대/청량리',         yanoljaRegion: '910020', yeogiKeyword: '동대문구 청량리' },
    { city: '서울', district: '장안동/답십리',              yanoljaRegion: '900408', yeogiKeyword: '성동구' },
    { city: '서울', district: '건대/군자/구의',             yanoljaRegion: '900406', yeogiKeyword: '광진구' },
    { city: '서울', district: '왕십리/성수/금호',           yanoljaRegion: '910021', yeogiKeyword: '성동구 왕십리' },
    { city: '서울', district: '수유/미아',                  yanoljaRegion: '900409', yeogiKeyword: '강북구' },
    { city: '서울', district: '상봉/중랑/면목',             yanoljaRegion: '900411', yeogiKeyword: '중랑구' },
    { city: '서울', district: '태릉/노원/도봉/창동',        yanoljaRegion: '900412', yeogiKeyword: '노원구' },
    // 부산
    { city: '부산', district: '해운대/센텀시티/재송',       yanoljaRegion: '900477', yeogiKeyword: '해운대구' },
    { city: '부산', district: '광안리/수영',                yanoljaRegion: '910047', yeogiKeyword: '수영구' },
    { city: '부산', district: '경성대/대연/용호동',         yanoljaRegion: '910048', yeogiKeyword: '남구' },
    { city: '부산', district: '서면/양정/초읍',             yanoljaRegion: '900481', yeogiKeyword: '부산진구' },
    { city: '부산', district: '남포동/중앙동/태종대/영도',  yanoljaRegion: '910043', yeogiKeyword: '영도구' },
    { city: '부산', district: '부산역/범일동/부산진역',     yanoljaRegion: '910044', yeogiKeyword: '동구' },
    { city: '부산', district: '연산/토곡',                  yanoljaRegion: '900480', yeogiKeyword: '연제구' },
    { city: '부산', district: '동래/사직/부산대/구서',      yanoljaRegion: '900483', yeogiKeyword: '금정구' },
    { city: '부산', district: '사상/엄궁/학장',             yanoljaRegion: '900484', yeogiKeyword: '사상구' },
    { city: '부산', district: '덕천/화명/구포',             yanoljaRegion: '910045', yeogiKeyword: '북구' },
    { city: '부산', district: '하단/명지/강서',             yanoljaRegion: '910046', yeogiKeyword: '사하구' },
    { city: '부산', district: '송정/기장/정관',             yanoljaRegion: '900478', yeogiKeyword: '기장군' },
    // 대구
    { city: '대구', district: '동성로/서문시장/대구역/경북대', yanoljaRegion: '910265', yeogiKeyword: '중구' },
    { city: '대구', district: '동대구역/신천동/수성못',     yanoljaRegion: '910266', yeogiKeyword: '수성구' },
    // 인천
    { city: '인천', district: '부평',                       yanoljaRegion: '900435', yeogiKeyword: '부평구' },
    { city: '인천', district: '구월/소래포구',              yanoljaRegion: '910283', yeogiKeyword: '남동구' },
    { city: '인천', district: '서구(석남/검단)',            yanoljaRegion: '910034', yeogiKeyword: '서구' },
    { city: '인천', district: '주안',                       yanoljaRegion: '900438', yeogiKeyword: '미추홀구' },
    { city: '인천', district: '송도/연수',                  yanoljaRegion: '900439', yeogiKeyword: '연수구' },
    { city: '인천', district: '인천공항/영종도',            yanoljaRegion: '910036', yeogiKeyword: '중구 영종도' },
    // 대전
    { city: '대전', district: '유성구',                     yanoljaRegion: '900459', yeogiKeyword: '유성구' },
    { city: '대전', district: '중구(은행/대흥)',            yanoljaRegion: '900460', yeogiKeyword: '중구' },
    { city: '대전', district: '동구(용전/복합터미널)',      yanoljaRegion: '900461', yeogiKeyword: '동구' },
    { city: '대전', district: '서구(둔산/용문)',            yanoljaRegion: '900462', yeogiKeyword: '서구' },
    // 울산
    { city: '울산', district: '남구/중구(삼산/성남)',       yanoljaRegion: '900488', yeogiKeyword: '남구' },
    { city: '울산', district: '동구/북구/울주군',           yanoljaRegion: '900487', yeogiKeyword: '동구' },
    // 수원
    { city: '수원', district: '인계동/나혜석거리',          yanoljaRegion: '910274', yeogiKeyword: '수원 인계동' },
    { city: '수원', district: '수원역/장안구',              yanoljaRegion: '910275', yeogiKeyword: '수원 장안구' },
    { city: '수원', district: '시청/영통/권선',             yanoljaRegion: '910276', yeogiKeyword: '수원 영통구' },
    // 고양
    { city: '고양', district: '일산/고양',                  yanoljaRegion: '900426', yeogiKeyword: '일산동구' },
    // 창원
    { city: '창원', district: '상남동/창원시청',            yanoljaRegion: '910053', yeogiKeyword: '성산구' },
    { city: '창원', district: '마산',                       yanoljaRegion: '910216', yeogiKeyword: '마산합포구' },
    // 광주
    { city: '광주', district: '서구/남구',                  yanoljaRegion: '910300', yeogiKeyword: '서구' },
    // 제주
    { city: '제주', district: '제주공항 서부(연동/노형)',   yanoljaRegion: '910271', yeogiKeyword: '제주시 연동' },
    { city: '제주', district: '제주공항 동부(제주시청/탑동)', yanoljaRegion: '910272', yeogiKeyword: '제주시 탑동' },
    { city: '제주', district: '서귀포시/중문',              yanoljaRegion: '900455', yeogiKeyword: '서귀포시' },
  ],

  // ═══════════════════════════════════════════════════════════
  // 호텔 — 전국 광역시·도 주요 생활권 + 관광지
  // ═══════════════════════════════════════════════════════════
  hotel: [
    // 서울
    { city: '서울', district: '강남/역삼/삼성',             yanoljaRegion: '910062', yeogiKeyword: '강남구' },
    { city: '서울', district: '신사/청담/압구정',           yanoljaRegion: '910063', yeogiKeyword: '압구정동' },
    { city: '서울', district: '서초/교대/사당',             yanoljaRegion: '910064', yeogiKeyword: '서초구' },
    { city: '서울', district: '잠실/송파/강동',             yanoljaRegion: '910065', yeogiKeyword: '송파구' },
    { city: '서울', district: '을지로/명동/중구/동대문',    yanoljaRegion: '910253', yeogiKeyword: '중구 명동' },
    { city: '서울', district: '서울역/이태원/용산',         yanoljaRegion: '910067', yeogiKeyword: '용산구' },
    { city: '서울', district: '종로/인사동',                yanoljaRegion: '910068', yeogiKeyword: '종로구' },
    { city: '서울', district: '홍대/합정/마포/서대문',      yanoljaRegion: '910153', yeogiKeyword: '마포구' },
    { city: '서울', district: '여의도',                     yanoljaRegion: '910072', yeogiKeyword: '영등포구 여의도' },
    { city: '서울', district: '영등포역',                   yanoljaRegion: '910073', yeogiKeyword: '영등포구' },
    { city: '서울', district: '건대입구/성수/왕십리',       yanoljaRegion: '910076', yeogiKeyword: '광진구' },
    { city: '서울', district: '성북/강북/노원/도봉',        yanoljaRegion: '910077', yeogiKeyword: '노원구' },
    // 부산
    { city: '부산', district: '해운대/마린시티',            yanoljaRegion: '910078', yeogiKeyword: '해운대구' },
    { city: '부산', district: '벡스코/센텀시티',            yanoljaRegion: '910079', yeogiKeyword: '해운대구 센텀' },
    { city: '부산', district: '광안리/경성대',              yanoljaRegion: '910081', yeogiKeyword: '수영구' },
    { city: '부산', district: '부산역',                     yanoljaRegion: '910082', yeogiKeyword: '동구 부산역' },
    { city: '부산', district: '자갈치/남포동/영도',         yanoljaRegion: '910083', yeogiKeyword: '중구 남포동' },
    { city: '부산', district: '서면/연산/범일',             yanoljaRegion: '910085', yeogiKeyword: '부산진구 서면' },
    { city: '부산', district: '동래/온천/금정구',           yanoljaRegion: '910086', yeogiKeyword: '금정구' },
    { city: '부산', district: '사상/강서/김해공항/하단',    yanoljaRegion: '910087', yeogiKeyword: '사상구' },
    // 제주
    { city: '제주', district: '제주시/제주국제공항',        yanoljaRegion: '910088', yeogiKeyword: '제주시' },
    { city: '제주', district: '서귀포시/모슬포',            yanoljaRegion: '910162', yeogiKeyword: '서귀포시' },
    { city: '제주', district: '애월/한림/협재',             yanoljaRegion: '910163', yeogiKeyword: '제주 애월' },
    { city: '제주', district: '중문',                       yanoljaRegion: '910164', yeogiKeyword: '서귀포 중문' },
    { city: '제주', district: '표선/성산',                  yanoljaRegion: '910165', yeogiKeyword: '제주 성산' },
    { city: '제주', district: '함덕/김녕/세화',             yanoljaRegion: '910166', yeogiKeyword: '제주 함덕' },
    // 경기
    { city: '경기', district: '가평/청평/양평',             yanoljaRegion: '910091', yeogiKeyword: '가평' },
    { city: '경기', district: '수원/화성',                  yanoljaRegion: '910167', yeogiKeyword: '수원시' },
    { city: '경기', district: '고양/파주/김포',             yanoljaRegion: '910093', yeogiKeyword: '고양시' },
    { city: '경기', district: '용인/동탄',                  yanoljaRegion: '910168', yeogiKeyword: '용인시' },
    { city: '경기', district: '남양주/구리/성남/분당',      yanoljaRegion: '910097', yeogiKeyword: '성남시' },
    // 인천
    { city: '인천', district: '송도/소래포구',              yanoljaRegion: '910101', yeogiKeyword: '연수구 송도' },
    { city: '인천', district: '인천국제공항/강화/을왕리',   yanoljaRegion: '910102', yeogiKeyword: '중구 영종도' },
    { city: '인천', district: '영종도/월미도',              yanoljaRegion: '910103', yeogiKeyword: '중구 월미도' },
    // 강원
    { city: '강원', district: '강릉',                       yanoljaRegion: '910108', yeogiKeyword: '강릉시' },
    { city: '강원', district: '속초/고성',                  yanoljaRegion: '910279', yeogiKeyword: '속초시' },
    { city: '강원', district: '양양',                       yanoljaRegion: '910280', yeogiKeyword: '양양군' },
    { city: '강원', district: '춘천/인제/철원',             yanoljaRegion: '910107', yeogiKeyword: '춘천시' },
    { city: '강원', district: '평창/정선/영월',             yanoljaRegion: '910109', yeogiKeyword: '평창군' },
    { city: '강원', district: '동해/삼척/태백',             yanoljaRegion: '910110', yeogiKeyword: '동해시' },
    // 경상
    { city: '경상', district: '대구/구미/안동/문경',        yanoljaRegion: '910112', yeogiKeyword: '대구 중구' },
    { city: '경상', district: '경주',                       yanoljaRegion: '910113', yeogiKeyword: '경주시' },
    { city: '경상', district: '울산/양산/밀양',             yanoljaRegion: '910114', yeogiKeyword: '울산 남구' },
    { city: '경상', district: '거제/통영',                  yanoljaRegion: '910115', yeogiKeyword: '거제시' },
    { city: '경상', district: '포항/영덕/울진',             yanoljaRegion: '910116', yeogiKeyword: '포항시' },
    { city: '경상', district: '창원/마산/진해/김해',        yanoljaRegion: '910117', yeogiKeyword: '창원시' },
    { city: '경상', district: '남해/사천/하동/진주',        yanoljaRegion: '910118', yeogiKeyword: '진주시' },
    // 전라
    { city: '전라', district: '전주/완주',                  yanoljaRegion: '910258', yeogiKeyword: '전주시' },
    { city: '전라', district: '광주/나주/함평',             yanoljaRegion: '910120', yeogiKeyword: '광주 서구' },
    { city: '전라', district: '여수',                       yanoljaRegion: '910121', yeogiKeyword: '여수시' },
    { city: '전라', district: '순천/광양/담양',             yanoljaRegion: '910260', yeogiKeyword: '순천시' },
    { city: '전라', district: '목포/신안/해남',             yanoljaRegion: '910261', yeogiKeyword: '목포시' },
    // 충청
    { city: '충청', district: '대전/세종',                  yanoljaRegion: '910125', yeogiKeyword: '대전 유성구' },
    { city: '충청', district: '천안/아산/도고',             yanoljaRegion: '910126', yeogiKeyword: '천안시' },
    { city: '충청', district: '당진/덕산/태안/안면도',      yanoljaRegion: '910127', yeogiKeyword: '태안군' },
    { city: '충청', district: '보령/대천/부여/공주',        yanoljaRegion: '910128', yeogiKeyword: '보령시' },
    { city: '충청', district: '청주/음성/진천',             yanoljaRegion: '910129', yeogiKeyword: '청주시' },
    { city: '충청', district: '충주/제천/단양',             yanoljaRegion: '910130', yeogiKeyword: '충주시' },
  ],

  // ═══════════════════════════════════════════════════════════
  // 펜션 — 전국 자연환경·관광권 중심
  // ═══════════════════════════════════════════════════════════
  pension: [
    // 가평
    { city: '가평', district: '남이섬/가평읍',              yanoljaRegion: '910233', yeogiKeyword: '가평 남이섬' },
    { city: '가평', district: '자라섬/북면',                yanoljaRegion: '910234', yeogiKeyword: '가평 자라섬' },
    { city: '가평', district: '아침고요수목원/상면',        yanoljaRegion: '910235', yeogiKeyword: '가평 아침고요' },
    { city: '가평', district: '청평/설악/쁘띠프랑스',       yanoljaRegion: '910236', yeogiKeyword: '가평 청평' },
    // 강원
    { city: '강원', district: '강릉(경포대/안목해변)',      yanoljaRegion: '910254', yeogiKeyword: '강릉 경포대' },
    { city: '강원', district: '강릉(사천/정동진/주문진)',   yanoljaRegion: '910255', yeogiKeyword: '강릉 정동진' },
    { city: '강원', district: '속초/고성',                  yanoljaRegion: '900213', yeogiKeyword: '속초시' },
    { city: '강원', district: '양양',                       yanoljaRegion: '910172', yeogiKeyword: '양양군' },
    { city: '강원', district: '동해/삼척',                  yanoljaRegion: '900220', yeogiKeyword: '동해시' },
    { city: '강원', district: '춘천/강촌',                  yanoljaRegion: '900212', yeogiKeyword: '춘천시' },
    { city: '강원', district: '홍천',                       yanoljaRegion: '900215', yeogiKeyword: '홍천군' },
    { city: '강원', district: '평창',                       yanoljaRegion: '900216', yeogiKeyword: '평창군' },
    { city: '강원', district: '횡성/영월/정선',             yanoljaRegion: '900690', yeogiKeyword: '횡성군' },
    { city: '강원', district: '철원/인제/화천',             yanoljaRegion: '900221', yeogiKeyword: '인제군' },
    // 경기/인천
    { city: '경기', district: '남양주',                     yanoljaRegion: '910188', yeogiKeyword: '남양주시' },
    { city: '경기', district: '포천',                       yanoljaRegion: '910177', yeogiKeyword: '포천시' },
    { city: '경기', district: '양평/용문',                  yanoljaRegion: '900200', yeogiKeyword: '양평군' },
    { city: '경기', district: '파주/양주/연천',             yanoljaRegion: '900202', yeogiKeyword: '파주시' },
    { city: '경기', district: '용인/여주/화성/이천',        yanoljaRegion: '900204', yeogiKeyword: '여주시' },
    { city: '인천', district: '강화도/석모도',              yanoljaRegion: '900228', yeogiKeyword: '강화군' },
    { city: '인천', district: '대부도/영흥도/선재도',       yanoljaRegion: '900205', yeogiKeyword: '안산 대부도' },
    { city: '인천', district: '을왕리/영종도',              yanoljaRegion: '900230', yeogiKeyword: '중구 을왕리' },
    // 충청
    { city: '충남', district: '태안(만리포/청포대)',        yanoljaRegion: '910239', yeogiKeyword: '태안 만리포' },
    { city: '충남', district: '태안(안면도/꽃지)',          yanoljaRegion: '910240', yeogiKeyword: '태안 안면도' },
    { city: '충남', district: '보령/대천해수욕장',          yanoljaRegion: '900534', yeogiKeyword: '보령 대천' },
    { city: '충남', district: '당진/서천/서산/예산',        yanoljaRegion: '900234', yeogiKeyword: '서산시' },
    { city: '충남', district: '부여/논산/공주/아산',        yanoljaRegion: '910180', yeogiKeyword: '공주시' },
    { city: '충북', district: '단양',                       yanoljaRegion: '900238', yeogiKeyword: '단양군' },
    { city: '충북', district: '제천/충주',                  yanoljaRegion: '900239', yeogiKeyword: '제천시' },
    { city: '충북', district: '괴산/보은/청주',             yanoljaRegion: '900241', yeogiKeyword: '청주시' },
    // 경상
    { city: '경북', district: '경주(황리단길/보문)',        yanoljaRegion: '910256', yeogiKeyword: '경주 보문' },
    { city: '경북', district: '경주(감포/불국사)',          yanoljaRegion: '910257', yeogiKeyword: '경주 감포' },
    { city: '경북', district: '포항',                       yanoljaRegion: '900252', yeogiKeyword: '포항시' },
    { city: '경북', district: '영덕/울진',                  yanoljaRegion: '900691', yeogiKeyword: '영덕군' },
    { city: '경북', district: '문경/안동/상주/영주',        yanoljaRegion: '910222', yeogiKeyword: '문경시' },
    { city: '경남', district: '거제도 남부(바람의언덕)',    yanoljaRegion: '910237', yeogiKeyword: '거제 바람의언덕' },
    { city: '경남', district: '거제도 북부(매미성)',        yanoljaRegion: '910238', yeogiKeyword: '거제시' },
    { city: '경남', district: '남해',                       yanoljaRegion: '900244', yeogiKeyword: '남해군' },
    { city: '경남', district: '통영',                       yanoljaRegion: '900245', yeogiKeyword: '통영시' },
    { city: '경남', district: '사천/산청/하동/합천',        yanoljaRegion: '900247', yeogiKeyword: '사천시' },
    { city: '경남', district: '밀양/양산/김해/창원',        yanoljaRegion: '900248', yeogiKeyword: '밀양시' },
    // 전라
    { city: '전남', district: '여수(돌산/금오도)',          yanoljaRegion: '910287', yeogiKeyword: '여수 돌산' },
    { city: '전남', district: '여수(엑스포/화양)',          yanoljaRegion: '910288', yeogiKeyword: '여수시' },
    { city: '전남', district: '순천/구례',                  yanoljaRegion: '900258', yeogiKeyword: '순천시' },
    { city: '전남', district: '무안/해남/완도',             yanoljaRegion: '900261', yeogiKeyword: '해남군' },
    { city: '전남', district: '담양/곡성/장성',             yanoljaRegion: '910179', yeogiKeyword: '담양군' },
    { city: '전북', district: '부안(변산반도)',             yanoljaRegion: '900264', yeogiKeyword: '부안군' },
    { city: '전북', district: '무주',                       yanoljaRegion: '900265', yeogiKeyword: '무주군' },
    { city: '전북', district: '전주',                       yanoljaRegion: '900573', yeogiKeyword: '전주시' },
    { city: '전북', district: '고창/남원/완주',             yanoljaRegion: '900268', yeogiKeyword: '고창군' },
    // 제주
    { city: '제주', district: '제주시 서부(공항/애월/협재)', yanoljaRegion: '910210', yeogiKeyword: '제주 애월' },
    { city: '제주', district: '제주시 동부(조천/구좌/우도)', yanoljaRegion: '910211', yeogiKeyword: '제주 구좌' },
    { city: '제주', district: '서귀포 서부(중문/안덕/대정)', yanoljaRegion: '910212', yeogiKeyword: '서귀포 중문' },
    { city: '제주', district: '서귀포 동부(성산/표선/남원)', yanoljaRegion: '910213', yeogiKeyword: '서귀포 성산' },
  ],

  // ═══════════════════════════════════════════════════════════
  // 게스트하우스 — 제주·강원·서울·부산·경주 등 여행자 밀집지
  // ═══════════════════════════════════════════════════════════
  guesthouse: [
    // 제주
    { city: '제주', district: '제주공항/이호테우해변',      yanoljaRegion: '910143', yeogiKeyword: '제주시 이호' },
    { city: '제주', district: '제주공항/삼양해수욕장',      yanoljaRegion: '910144', yeogiKeyword: '제주시 삼양' },
    { city: '제주', district: '함덕/사려니숲길',            yanoljaRegion: '910145', yeogiKeyword: '제주 함덕' },
    { city: '제주', district: '월정/세화(월정리해변)',      yanoljaRegion: '910146', yeogiKeyword: '제주 월정리' },
    { city: '제주', district: '성산(우도/섭지코지)',        yanoljaRegion: '910147', yeogiKeyword: '제주 성산' },
    { city: '제주', district: '표선/남원',                  yanoljaRegion: '910148', yeogiKeyword: '서귀포 표선' },
    { city: '제주', district: '서귀포(중문/천지연폭포)',    yanoljaRegion: '910149', yeogiKeyword: '서귀포시' },
    { city: '제주', district: '산방산(모슬포/마라도)',      yanoljaRegion: '910150', yeogiKeyword: '서귀포 안덕' },
    { city: '제주', district: '협재(차귀도/풍차해안)',      yanoljaRegion: '910151', yeogiKeyword: '제주 협재' },
    { city: '제주', district: '애월(곽지해변/새별오름)',    yanoljaRegion: '910152', yeogiKeyword: '제주 애월' },
    // 강원
    { city: '강원', district: '강릉',                       yanoljaRegion: '910183', yeogiKeyword: '강릉시' },
    { city: '강원', district: '속초/양양/고성',             yanoljaRegion: '900128', yeogiKeyword: '속초시' },
    { city: '강원', district: '동해/삼척/태백',             yanoljaRegion: '900127', yeogiKeyword: '동해시' },
    { city: '강원', district: '춘천/화천/양구/인제',        yanoljaRegion: '900129', yeogiKeyword: '춘천시' },
    { city: '강원', district: '홍천/횡성/원주/평창',        yanoljaRegion: '910184', yeogiKeyword: '홍천군' },
    // 경북
    { city: '경북', district: '경주',                       yanoljaRegion: '900158', yeogiKeyword: '경주시' },
    { city: '경북', district: '안동/봉화/문경/포항',        yanoljaRegion: '900159', yeogiKeyword: '안동시' },
    // 부산
    { city: '부산', district: '해운대/기장',                yanoljaRegion: '900173', yeogiKeyword: '해운대구' },
    { city: '부산', district: '남포동/자갈치',              yanoljaRegion: '900174', yeogiKeyword: '중구 남포동' },
    { city: '부산', district: '부산역/송도/감천',           yanoljaRegion: '900175', yeogiKeyword: '동구 부산역' },
    { city: '부산', district: '광안리',                     yanoljaRegion: '900176', yeogiKeyword: '수영구 광안리' },
    { city: '부산', district: '서면',                       yanoljaRegion: '900177', yeogiKeyword: '부산진구 서면' },
    // 전남/전북
    { city: '전남', district: '목포/신안/해남/함평',        yanoljaRegion: '900147', yeogiKeyword: '목포시' },
    { city: '전남', district: '담양/나주/구례/곡성',        yanoljaRegion: '900146', yeogiKeyword: '담양군' },
    { city: '전남', district: '여수/순천',                  yanoljaRegion: '900145', yeogiKeyword: '여수시' },
    { city: '전북', district: '전주',                       yanoljaRegion: '900136', yeogiKeyword: '전주시' },
    { city: '전북', district: '군산/익산/남원/진안',        yanoljaRegion: '900137', yeogiKeyword: '군산시' },
    // 서울
    { city: '서울', district: '종로/삼청동/북촌/인사동',   yanoljaRegion: '900107', yeogiKeyword: '종로구' },
    { city: '서울', district: '동대문/대학로/노원',         yanoljaRegion: '910185', yeogiKeyword: '동대문구' },
    { city: '서울', district: '홍대/신촌',                  yanoljaRegion: '900109', yeogiKeyword: '마포구 홍대' },
    { city: '서울', district: '명동/남산/남대문',           yanoljaRegion: '900110', yeogiKeyword: '중구 명동' },
    { city: '서울', district: '강남/잠실/건대/뚝섬',       yanoljaRegion: '910186', yeogiKeyword: '강남구' },
    { city: '서울', district: '서울역/용산/이태원',         yanoljaRegion: '900112', yeogiKeyword: '용산구' },
    { city: '서울', district: '영등포/여의도/신림',         yanoljaRegion: '900114', yeogiKeyword: '영등포구' },
    // 경기
    { city: '경기', district: '가평/양평/경기북부',         yanoljaRegion: '910181', yeogiKeyword: '가평군' },
    { city: '경기', district: '수원/용인/경기남부',         yanoljaRegion: '910182', yeogiKeyword: '수원시' },
    // 충청
    { city: '충청', district: '충남/대전/태안/공주',        yanoljaRegion: '910231', yeogiKeyword: '대전 유성구' },
    { city: '충청', district: '충북/단양/충주/제천',        yanoljaRegion: '910232', yeogiKeyword: '단양군' },
    // 경남/울산
    { city: '경남', district: '통영/거제',                  yanoljaRegion: '910218', yeogiKeyword: '통영시' },
    { city: '경남', district: '울산/남해/고성/사천',        yanoljaRegion: '910219', yeogiKeyword: '울산 남구' },
    { city: '경남', district: '하동/산청/함양/밀양',        yanoljaRegion: '910220', yeogiKeyword: '하동군' },
  ],
};

/**
 * 전체 지역 목록 (accommodationType 포함 flat array)
 */
function getAllRegions() {
  const list = [];
  for (const [type, regions] of Object.entries(REGIONS_BY_TYPE)) {
    for (const r of regions) {
      list.push({ ...r, accommodationType: type });
    }
  }
  return list;
}

/**
 * 특정 숙박 유형의 지역 목록
 */
function getRegionsByType(type) {
  return (REGIONS_BY_TYPE[type] || []).map((r) => ({ ...r, accommodationType: type }));
}

/**
 * 숙박 유형 목록
 */
function getAccommodationTypes() {
  return Object.keys(REGIONS_BY_TYPE);
}

module.exports = { REGIONS_BY_TYPE, getAllRegions, getRegionsByType, getAccommodationTypes };
