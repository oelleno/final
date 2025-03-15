import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// Firebase 초기화 함수
async function initializeFirebase() {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js");
    const { getStorage } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js");

    let firebaseConfig;
    try {
      const response = await fetch("https://us-central1-bodystar-1b77d.cloudfunctions.net/getFirebaseConfig", {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP 오류: ${response.status}`);
      }

      firebaseConfig = await response.json();
      console.log("Firebase 설정 가져오기 성공 (일회권 카카오)");
    } catch (error) {
      console.error("Firebase 설정을 가져오는데 실패했습니다:", error);
      throw error;
    }

    const app = initializeApp(firebaseConfig, "kakao-onetime-app");

    return {
      db: getFirestore(app),
      storage: getStorage(app),
      auth: getAuth(app)
    };
  } catch (error) {
    console.error("Firebase 초기화 오류:", error);
    throw error;
  }
}

// Firestore에서 카카오 API 설정 가져오기
async function getKakaoSettings() {
  try {
    const firebaseInstance = await initializeFirebase();
    const dbInstance = firebaseInstance.db;

    const kakaoDocRef = doc(dbInstance, "AdminSettings", "kakao");
    const kakaoDocSnap = await getDoc(kakaoDocRef);

    if (!kakaoDocSnap.exists()) {
      throw new Error("카카오 설정 문서를 찾을 수 없습니다.");
    }

    return kakaoDocSnap.data();
  } catch (error) {
    console.error("카카오 설정 가져오기 오류:", error);
    return null;
  }
}

// 카카오 API 설정 캐싱 및 초기화
let KAKAO_CONFIG = null;
async function initializeKakao() {
  if (!KAKAO_CONFIG) {
    KAKAO_CONFIG = await getKakaoSettings();
  }
  return KAKAO_CONFIG;
}

// 카카오 알림톡 API 호출 함수
async function sendKakaooneAlimtalk(params) {
  try {
    const kakaoConfig = await initializeKakao();
    if (!kakaoConfig) {
      throw new Error("카카오 설정을 불러오지 못했습니다.");
    }

    // DB 필드명 그대로 사용
    params.append('apikey', kakaoConfig.API_KEY);
    params.append('userid', kakaoConfig.USER_ID);
    params.append('senderkey', kakaoConfig.SENDER_KEY);
    params.append('sender', kakaoConfig.SENDER_PHONE);

    console.log("API 요청 전송 중...");

    const response = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const result = await response.json();
    console.log('카카오 알림톡 전송 결과:', result);

    if (result.code === 0 && result.message === '성공적으로 전송요청 하였습니다.') {
      console.log('알림톡 전송 성공!');
      window.dispatchEvent(new Event('kakaoSendSuccess'));
      return true;
    } else {
      console.error('알림톡 전송 실패 - API 응답:', result);
      throw new Error('알림톡 전송 실패: ' + (result.message || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('카카오 API 요청 오류:', error);
    throw error;
  }
}

// Firestore에서 일회권 계약 정보 조회
async function getContractData() {
  if (!window.docIdone) {
    // localStorage에서 docIdone 가져오기 시도
    window.docIdone = localStorage.getItem('receipt_doc_id');

    // 영수증 ID에서 실제 문서 ID 추출 (예: K250313one_002_영수증 -> K250313one_002)
    if (window.docIdone && window.docIdone.includes('_영수증')) {
      window.docIdone = window.docIdone.replace('_영수증', '');
    }

    if (!window.docIdone) {
      throw new Error('일회권 번호(docIdone)가 없습니다.');
    }
  }

  try {
    const firebaseInstance = await initializeFirebase();
    const dbInstance = firebaseInstance.db;

    console.log("조회할 문서 ID:", window.docIdone);

    // Firestore에서 일회권 문서 가져오기
    const docRef = doc(dbInstance, "Onetimepass", window.docIdone);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // 다른 형식의 docId 탐색 (branch/year/Onetimepass 구조)
      const branches = ["용문가장점", "관저점"]; // 지점 목록
      const year = new Date().getFullYear().toString();

      for (const branch of branches) {
        const alternateDocRef = doc(dbInstance, branch, year, "Onetimepass", window.docIdone);
        const alternateDocSnap = await getDoc(alternateDocRef);

        if (alternateDocSnap.exists()) {
          console.log(`문서 찾음: ${branch}/${year}/Onetimepass/${window.docIdone}`);
          return alternateDocSnap.data();
        }
      }

      throw new Error('일회권 계약서를 찾을 수 없습니다. docIdone: ' + window.docIdone);
    }

    const userData = docSnap.data();
    console.log("일회권 사용자 데이터 조회 성공:", userData.name);

    // 필수 정보 확인
    if (!userData.imageUrl) {
      throw new Error('계약서 이미지가 아직 업로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }

    if (!userData.contact) {
      throw new Error('연락처 정보가 없습니다.');
    }

    return userData;
  } catch (error) {
    console.error("일회권 데이터 가져오기 오류:", error);
    throw error;
  }
}

// 회원에게 카카오 알림톡 전송
async function sendKakaoneMember() {
  try {
    const kakaoConfig = await initializeKakao();
    if (!kakaoConfig) {
      throw new Error("카카오 설정을 불러오지 못했습니다.");
    }

    // docIdone이 설정되어 있는지 확인
    if (!window.docIdone) {
      window.docIdone = localStorage.getItem('receipt_doc_id');
      console.log("sendKakaoneMember에서 docIdone 재설정:", window.docIdone);

      if (!window.docIdone) {
        throw new Error('일회권 번호(docIdone)가 없습니다. 페이지를 새로고침하고 다시 시도해주세요.');
      }
    }

    // 일회권 계약 데이터 가져오기
    const userData = await getContractData();
    const customerName = userData.name;
    const customerPhone = userData.contact;
    const contractUrl = userData.imageUrl ? userData.imageUrl.replace('https://', '') : '';

    if (!customerPhone) {
      throw new Error('회원 전화번호를 찾을 수 없습니다.');
    }

    console.log(`회원 알림톡 전송 중: ${customerName}님 (${customerPhone})`);

    // 회원용 알림톡 파라미터 설정
    const params = new URLSearchParams({
      'tpl_code': 'TY_1680',
      'receiver_1': customerPhone,
      'subject_1': '계약서',
      'message_1': `[${kakaoConfig.COMPANY_NAME}]\n안녕하세요. ${customerName}님!\n${kakaoConfig.COMPANY_NAME}에 등록해주셔서 진심으로 감사드립니다!`,
      'button_1': JSON.stringify({
        "button": [
          { "name": "채널추가", "linkType": "AC", "linkTypeName": "채널 추가" },
          {
            "name": "계약서 바로가기",
            "linkType": "WL",
            "linkTypeName": "웹링크",
            "linkPc": `https://${contractUrl}`,
            "linkMo": `https://${contractUrl}`
          }
        ]
      }),
      'failover': 'N'
    });

    await sendKakaooneAlimtalk(params);
    return true;
  } catch (error) {
    console.error('회원 알림톡 전송 실패:', error);
    throw error;
  }
}

// Firestore에서 관리자 설정의 매니저 전화번호 가져오기
async function getManagerPhone() {
  try {
    const firebaseInstance = await initializeFirebase();
    const dbInstance = firebaseInstance.db;

    try {
      // 관리자 설정에서 매니저 전화번호 가져오기
      const docRef = doc(dbInstance, "AdminSettings", "kakao");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data().managerPhone;
      }
    } catch (err) {
      console.log("AdminSettings 접근 권한 없음, 기본 전화번호 사용:", err.message);
    }

    // 기본 전화번호 반환
    return '01092792273';
  } catch (error) {
    console.error("매니저 전화번호 로딩 오류:", error);
    return '01092792273';
  }
}

// 매니저에게 카카오 알림톡 전송
async function sendKakaooneManager() {
  try {
    const kakaoConfig = await initializeKakao();
    if (!kakaoConfig) {
      throw new Error("카카오 설정을 불러오지 못했습니다.");
    }

    // 계약 데이터 가져오기
    const userData = await getContractData();
    const contractUrl = userData.imageUrl ? userData.imageUrl.replace('https://', '') : '';
    const 계약서 = '일회권신청서';

    // 매니저 전화번호 가져오기
    const managerPhone = await getManagerPhone();

    // 매니저용 알림톡 파라미터 설정
    const params = new URLSearchParams({
      'tpl_code': 'TY_6920',
      'receiver_1': managerPhone,
      'subject_1': '계약알림',
      'emtitle_1': `${계약서} 도착!`,
      'message_1': `[${userData.branch},${userData.contract_manager}]\n`
      + `■ ${window.docIdone}, ${userData.gender}\n`
      + `■ 연락처: ${userData.contact}\n`
      + `■ 결제금액: ${userData.totalAmount ? userData.totalAmount.replace('₩', '').replace('₩ ', '').trim() + '원' : '0원'}\n`
      + `■ 할인항목: ${userData.discountType && userData.discount ? `${userData.discountType} ${parseInt(userData.discount.replace(/[^\d]/g, '')).toLocaleString('ko-KR')}원` : '없음'}\n`
      + `■ 가입경로: ${userData.referral_sources.map(ref => ref.source + (ref.detail ? `: ${ref.detail}` : '')).join(', ')}\n`,
      'button_1': JSON.stringify({
        "button": [
          {
            "name": "계약서 바로가기",
            "linkType": "WL",
            "linkTypeName": "웹링크",
            "linkPc": `https://${contractUrl}`,
            "linkMo": `https://${contractUrl}`
          },
          {
            "name": "영수증 바로가기",
            "linkType": "WL",
            "linkTypeName": "웹링크",
            "linkPc": `${userData.receipts?.[0]?.url || contractUrl}`,
            "linkMo": `${userData.receipts?.[0]?.url || contractUrl}`
          }
        ]
      }),
      'failover': 'N'
    });

    await sendKakaooneAlimtalk(params);
    console.log('매니저 알림이 전송되었습니다.');
    return true;
  } catch (error) {
    console.error('매니저 알림톡 전송 실패:', error);
    throw error;
  }
}

export { sendKakaoneMember, sendKakaooneManager };