import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";

// 공통 영수증 파일명 생성 함수 (전역으로 사용 가능)
window.generateReceiptFileName = function(docId, receiptIndex, noteText) {
  // 일회권인지 여부 확인
  const isOneTime = docId.includes('one');

  // 문서 ID에서 정보 추출
  const docIdParts = docId.split('_');
  const branchCode = isOneTime ? docIdParts[0].replace('one', '') : docIdParts[0]; // YM250313one에서 YM250313 추출
  const serialNum = docIdParts[1] || '001'; // 001
  const nameValue = docIdParts[2] || '';  // 이름

  // 브랜치 코드 추출  
  if (window.branchCodes && typeof window.branchCodes === 'object') {
    // branch_code가 존재하는 경우 이를 사용
    for (const branch in window.branchCodes) {
      if (window.branchCodes[branch] === branchCode) {
        console.log(`브랜치 코드 ${branchCode}에 해당하는 지점: ${branch}`);
        break;
      }
    }
  }

  // 새 형식: branch_code250313_001_소피아_R1_영수증노트에적은내용.jpg
  return `${branchCode}_${serialNum}_${nameValue}_R${receiptIndex}_${noteText}.jpg`;
};

/* Firebase 설정 가져오기 - 클라우드 함수에서 Firebase 구성 정보를 가져오는 함수 */
async function getFirebaseConfig() {
    try {
        // 먼저 클라우드 함수에서 설정 가져오기 시도
        const response = await fetch("https://us-central1-bodystar-1b77d.cloudfunctions.net/getFirebaseConfig", {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP 오류: ${response.status}`);
        }

        const config = await response.json();

        // 한 번만 로그 출력
        if (!window._configLogged) {
            console.log("Firebase 설정 가져오기 성공");
            window._configLogged = true;
        }
        return config;
    } catch (error) {
        console.warn("클라우드 함수에서 Firebase 설정 가져오기 실패, 폴백 설정 사용:", error);

        // 폴백 Firebase 설정 (웹뷰 로그에서 확인된 설정 사용)
        return {
            apiKey: "AIzaSyAyP5QTMzBtz8lMEzkE4C66CjFbZ3a17QM",
            authDomain: "bodystar-1b77d.firebaseapp.com",
            projectId: "bodystar-1b77d",
            storageBucket: "bodystar-1b77d.appspot.com",
            messagingSenderId: "1069668103083",
            appId: "1:1069668103083:web:a3f71da3d1ecc46d68aaa7"
        };
    }
}

let firebaseInstance = null;

/* Firebase 초기화 - 필요한 Firebase 서비스(인증, 데이터베이스, 스토리지)를 초기화하고 반환하는 함수 */
async function initializeFirebase() {
    if (!firebaseInstance) {
        try {
            const firebaseConfig = await getFirebaseConfig();
            // 앱 인스턴스 이름 지정하여 중복 초기화 방지
            const app = initializeApp(firebaseConfig, "main-app-instance");
            firebaseInstance = {
                auth: getAuth(app),
                db: getFirestore(app),
                storage: getStorage(app)
            };
            // 한 번만 로그 출력을 위한 플래그
            if (!window._mainFirebaseInitialized) {
                console.log("✅ Firestore 초기화 완료:", firebaseInstance.db);
                console.log("✅ Firebase Auth 초기화 완료:", firebaseInstance.auth);
                window._mainFirebaseInitialized = true;
            }
        } catch (error) {
            console.error("Firebase 초기화 중 오류 발생:", error);
            throw error;
        }
    }
    return firebaseInstance;
}

/* 외부에서 사용할 Firebase 서비스들을 Promise 형태로 내보내기 */
export const db = initializeFirebase().then(instance => instance.db);
export const auth = initializeFirebase().then(instance => instance.auth);
export const storage = initializeFirebase().then(instance => instance.storage);

// 페이지 로드 시 지점 및 매니저 데이터 로드
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Firebase 설정
        const dbInstance = await db;

        // AdminSettings/settings 문서에서 데이터 가져오기
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js");
        const settingsDocRef = doc(dbInstance, "AdminSettings", "settings");
        const settingsDocSnap = await getDoc(settingsDocRef);

        if (settingsDocSnap.exists()) {
            const settingsData = settingsDocSnap.data();

            // 지점 드롭다운 찾기
            const branchSelect = document.getElementById('branch');
            if (branchSelect) {
                // 기존 옵션 제거 (맨 처음 기본 옵션 제외)
                while (branchSelect.options.length > 1) {
                    branchSelect.remove(1);
                }

                // 지점 데이터 가져오기
                const branches = settingsData.branch || {};

                // 모든 지점 데이터 추가
                Object.keys(branches).forEach(branchKey => {
                    const option = document.createElement('option');
                    option.value = branchKey;
                    option.textContent = branchKey;
                    branchSelect.appendChild(option);

                    // 각 지점의 매니저 데이터 저장
                    branchSelect.setAttribute(`data-managers-${branchKey}`, JSON.stringify(branches[branchKey]));
                });

                // 지점 변경 이벤트 리스너 등록
                branchSelect.addEventListener('change', updateManagerList);
            }

            // 브랜치 코드 저장 (전역 변수)
            window.branchCodes = settingsData.branchCodes || {};

        } else {
            console.warn("설정 데이터를 찾을 수 없습니다.");
        }
    } catch (error) {
        console.error("지점/매니저 데이터 로드 오류:", error);
    }
});

// 매니저 목록 업데이트 함수
function updateManagerList() {
    const branchSelect = document.getElementById('branch');
    const managerSelect = document.getElementById('contract_manager');

    if (!branchSelect || !managerSelect) return;

    const selectedBranch = branchSelect.value;
    if (!selectedBranch) return;

    // 기존 옵션 제거 (첫 번째 옵션 제외)
    while (managerSelect.options.length > 1) {
        managerSelect.remove(1);
    }

    // 선택된 지점의 매니저 데이터 가져오기
    const managersData = branchSelect.getAttribute(`data-managers-${selectedBranch}`);
    if (managersData) {
        const managers = JSON.parse(managersData);

        // 매니저 옵션 추가
        Object.entries(managers).forEach(([index, name]) => {
            if (name && typeof name === 'string') {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                managerSelect.appendChild(option);
            }
        });
    }
}

/* 회원가입 양식 제출 함수 - 사용자 입력을 수집하여 Firestore에 저장 */
async function submitForm() {
    return new Promise(async (resolve, reject) => {
        try {
            const firebaseInstance = await initializeFirebase();
            const dbInstance = firebaseInstance.db;

            /* 폼 데이터 수집 및 기본 유효성 검사 */
            const formData = new FormData();
            const name = document.getElementById('name').value.trim();
            const contact = document.getElementById('contact').value.trim();
            const birthdate = document.getElementById('birthdate').value.trim();
            const address = document.getElementById('main_address').value.trim();
            const membership = document.getElementById('membership').value.trim();
            const isAdmin = localStorage.getItem("adminVerified");

            if (!name || !contact) {
                reject(new Error("이름과 연락처를 입력하세요."));
                return;
            }

            /* 추가 결제 및 회원권 정보 수집 */
            const rentalMonths = document.getElementById('rental_months').value.trim();
            const lockerMonths = document.getElementById('locker_months').value.trim();
            const membershipMonths = document.getElementById('membership_months').value.trim();
            const discount = document.getElementById('discount').value.trim();
            const totalAmount = document.getElementById('total_amount').value.trim();

            /* 문서 ID 생성을 위한 현재 날짜 및 일련번호 설정 */
            const now = new Date();
            const dateStr = now.getFullYear().toString().slice(2) +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0');

            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            const endOfDay = new Date(now.setHours(23, 59, 59, 999));

            /* 지점 정보 가져오기 */
            const branchValue = document.getElementById('branch')?.value || '';
            const year = new Date().getFullYear().toString();

            /* 오늘 생성된 문서 수를 계산하여 일련번호 생성 - 지점과 날짜별로 001부터 시작 */
            const membershipCollection = collection(dbInstance, branchValue, year, "Membership");
            const querySnapshot = await getDocs(membershipCollection);
            let todayDocs = 0;

            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.timestamp) {
                    const docDate = new Date(data.timestamp);
                    // 오늘 날짜의 문서만 카운트
                    if (docDate.getFullYear() === now.getFullYear() && 
                        docDate.getMonth() === now.getMonth() && 
                        docDate.getDate() === now.getDate()) {
                        todayDocs++;
                    }
                }
            });

            const dailyNumber = (todayDocs + 1).toString().padStart(3, '0');

            localStorage.setItem('current_doc_number', dailyNumber);

            /* 브랜치 코드 가져오기 */
            let branchCode = "";
            if (window.branchCodes && branchValue) {
                branchCode = window.branchCodes[branchValue] || "";
            } 

            // 브랜치 코드가 없으면 기본값으로 폴백
            if (!branchCode) {
                branchCode = branchValue === '용문가장점' ? 'YM' : branchValue === '관저점' ? 'GJ' : '';
            }
            console.log(`브랜치 코드 ${branchValue}: ${branchCode}`);

            /* 고유 문서 ID 생성: 브랜치코드+날짜_일련번호_이름 형식 */
            window.docId = `${branchCode}${dateStr}_${dailyNumber}_${name}`;
            // 브라우저 콘솔 및 localStorage에 저장 (영수증 페이지 이동을 위함)
            console.log("🚀 생성된 Doc ID:", window.docId);
            localStorage.setItem('current_doc_id', window.docId);

            /* 회원 정보 데이터 구성 */
            const userData = {
                docId: window.docId,
                name: name,
                contact: contact,
                birthdate: birthdate,
                address: address,
                membership: membership,
                branch: document.getElementById('branch')?.value || '',
                contract_manager: document.querySelector('input[name="contract_manager"]')?.value || document.getElementById('contract_manager')?.value || '',
                gender: document.querySelector('input[name="gender"]:checked')?.value || '',
                rental_months: rentalMonths,
                rental_price: document.getElementById('rental_price').value,
                locker_months: lockerMonths,
                locker_price: document.getElementById('locker_price').value,
                membership_months: membershipMonths,
                membership_fee: document.getElementById('membership_fee').value,
                admission_fee: document.getElementById('admission_fee').value,
                discount: discount,
                totalAmount: totalAmount,
                goals: Array.from(document.querySelectorAll('input[name="goal"]:checked')).map(cb => cb.value),
                other_goal: document.getElementById('other').value,
                workout_times: {
                    start: document.querySelector('select[name="morning_hour"]').value,
                    end: document.querySelector('select[name="afternoon_hour"]').value,
                    additional: document.querySelector('.time-input[type="text"]').value
                },
                payment_method: document.querySelector('input[name="payment"]:checked')?.value || '',
                payment_details: Array.from(document.querySelectorAll('#payment-items input')).reduce((acc, input, i) => {
                    if (i % 2 === 0) {
                        acc.push({
                            description: input.value,
                            amount: document.querySelectorAll('#payment-items input')[i + 1]?.value || ''
                        });
                    }
                    return acc;
                }, []),
                cash_receipt: document.querySelector('input[name="cash_receipt"]:checked')?.value || '',
                receipt_phone: document.getElementById('receipt_phone').value,
                membership_start_date: document.getElementById('membership_start_date').value,
                referral_sources: Array.from(document.querySelectorAll('input[name="referral"]:checked')).map(cb => ({
                    source: cb.value,
                    detail: cb.value === 'SNS' ? document.getElementById('snsField').value :
                        cb.value === '인터넷검색' ? document.querySelector('input[name="internet_detail"]').value :
                            cb.value === '지인추천' ? document.querySelector('input[name="referral_name"]').value : ''
                })),
                terms_agreed: {
                    main: document.querySelector('input[name="terms_agree"]').checked,
                    twentyfour_hour: document.querySelector('input[name="24h_terms_agree"]').checked,
                    refund: document.querySelector('input[name="refund_terms_agree"]').checked
                },
                timestamp: new Date().toISOString(),
                unpaid: document.getElementById('unpaid').value,
                adminVerified: isAdmin ? true : false
            };

            /* 폴더 구조에 맞게 Firestore에 회원 정보 저장 */
            const branchElement = document.getElementById('branch');
            const branchStr = branchElement ? branchElement.value || '' : '';
            const yearStr = new Date().getFullYear().toString();
            console.log(`저장 경로: ${branchStr}/${yearStr}/Membership/${window.docId}`);

            // 모든 매개변수가 문자열인지 확인
            if (typeof branchStr === 'string' && branchStr !== '' && typeof yearStr === 'string' && typeof window.docId === 'string') {
                await setDoc(doc(dbInstance, branchStr, yearStr, "Membership", window.docId), userData);
                console.log("문서 저장 성공");

                // 영수증 팝업을 위한 데이터를 window 객체에 저장
                console.log("영수증 저장 준비: docId =", window.docId);

                resolve();

                // 저장 완료 후 script.js의 downloadAsImage 함수 호출
                if (typeof window.downloadAsImage === 'function') {
                    setTimeout(() => {
                        console.log("영수증 팝업 표시 시작");
                        window.downloadAsImage();
                    }, 500);
                } else {
                    console.error("downloadAsImage 함수를 찾을 수 없습니다.");
                }
            } else {
                throw new Error(`유효하지 않은 문서 경로: ${branchStr}/${yearStr}/Membership/${window.docId}`);
            }
        } catch (error) {
            console.error("회원 정보 저장 중 오류 발생:", error);
            alert("회원 정보 저장에 실패했습니다.");
            reject(error);
        }
    });
}

/* 이미지 업로드 함수 - 서명이나 계약서 이미지를 Firebase Storage에 업로드하고 URL을 Firestore에 저장 */
async function uploadImage(fileName, blob) {
    try {
        const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js");
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js");

        const firebaseInstance = await initializeFirebase();
        const storage = firebaseInstance.storage;
        const db = firebaseInstance.db;

        // 폴더 구조에 맞게 Membership 컬렉션 경로 설정
        const collectionName = "Membership";
        const branch = document.getElementById('branch').value;
        const year = new Date().getFullYear().toString();

        // 페이지 기반으로 폴더 구분 (receipt.html인 경우 Receipt, 그 외에는 Contract)
        const isReceiptPage = window.location.pathname.includes('receipt.html');
        const fileType = isReceiptPage ? 'Receipt' : 'Contract';

        // 파일명에 docId를 사용하여 ID와 동일하게 맞춤
        const storageFileName = isReceiptPage ? fileName : window.docId;

        /* Firebase Storage에 이미지 업로드 - 새 폴더 구조 적용 */
        // selectedBranch는 이미 지점명 (관저점, 용문가장점)
        const storageRef = ref(storage, `${branch}/${year}/${collectionName}/${fileType}/${storageFileName}`);
        // Content-Disposition: attachment 메타데이터 추가
        const metadata = {
          contentDisposition: 'inline'
        };
        await uploadBytes(storageRef, blob, metadata);
        console.log("✅ Firebase Storage 업로드 완료!");

        /* 업로드된 이미지의 다운로드 URL 가져오기 */
        const downloadURL = await getDownloadURL(storageRef);
        console.log("🔗 Firebase Storage 이미지 URL:", downloadURL);

        /* Firestore 문서에 이미지 URL 업데이트 */
        if (window.docId) {
            const docRef = doc(db, branch, year, collectionName, window.docId);
            await updateDoc(docRef, { imageUrl: downloadURL });
            console.log(`✅ Firestore ${branch}/${year}/${collectionName}에 이미지 URL 저장 완료:`, downloadURL);
        } else {
            console.error("❌ Firestore 문서 ID(window.docId)가 제공되지 않음.");
        }

        return downloadURL;
    } catch (error) {
        console.error("❌ Firebase Storage 업로드 실패:", error);
        throw error;
    }
}


window.submitForm = submitForm;
window.uploadImage = uploadImage;