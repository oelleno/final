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
  const branchCodePart = isOneTime ? docIdParts[0].replace('one', '') : docIdParts[0]; // YM250313one에서 YM250313 추출
  const serialNum = docIdParts[1] || '001'; // 001
  const nameValue = docIdParts[2] || '';  // 이름

  // 새 형식: YM250313_001_소피아_R1_영수증노트에적은내용.jpg
  return `${branchCodePart}_${serialNum}_${nameValue}_R${receiptIndex}_${noteText}.jpg`;
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
        console.log("Firebase 설정 가져오기 성공");
        return config;
    } catch (error) {
        console.warn("클라우드 함수에서 Firebase 설정 가져오기 실패, 폴백 설정 사용:", error);

        throw new Error("Firebase 설정을 가져오는데 실패했습니다.");
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
            const app = initializeApp(firebaseConfig);
            firebaseInstance = {
                auth: getAuth(app),
                db: getFirestore(app),
                storage: getStorage(app)
            };
            console.log("✅ Firestore 초기화 완료:", firebaseInstance.db);
            console.log("✅ Firebase Auth 초기화 완료:", firebaseInstance.auth);
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

/* 일일권 양식 제출 함수 - 사용자 입력을 수집하여 Firestore에 저장 */
async function submitOnetimeForm() {
    return new Promise(async (resolve, reject) => {
        try {
            const firebaseInstance = await initializeFirebase();
            const dbInstance = firebaseInstance.db;

            /* 폼 데이터 수집 및 기본 유효성 검사 */
            const formData = new FormData();
            const name = document.getElementById('name').value.trim();
            const contact = document.getElementById('contact').value.trim();
            const price = document.getElementById('price').value.trim();
            const totalAmount = document.getElementById('total_amount').value.trim();
            const isAdmin = localStorage.getItem("adminVerified");

            if (!name || !contact) {
                reject(new Error("이름과 연락처를 입력하세요."));
                return;
            }

            /* 문서 ID 생성을 위한 현재 날짜 및 일련번호 설정 */
            const now = new Date();
            const dateStr = now.getFullYear().toString().slice(2) +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0');

            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            const endOfDay = new Date(now.setHours(23, 59, 59, 999));

            /* 지점 정보 가져오기 */
            const selectedBranch = document.getElementById('branch').value;
            const year = new Date().getFullYear().toString();

            /* 오늘 생성된 문서 수를 계산하여 일련번호 생성 - 지점과 날짜별로 001부터 시작 */
            const onetimeCollection = collection(dbInstance, selectedBranch, year, "Onetimepass");
            const querySnapshot = await getDocs(onetimeCollection);
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

            // Get branch code from settings ('YM' for 용문가장점, 'GJ' for 관저점)
            const branchPrefix = selectedBranch === '용문가장점' ? 'YM' : selectedBranch === '관저점' ? 'GJ' : '';

            // Set the correct document ID for onetime pass with branch prefix
            window.docIdone = `${branchPrefix}${dateStr}one_${dailyNumber}_${name}`;
            console.log("🚀 생성된 Doc ID:", window.docIdone);

            // Create the user data for Firestore
            const userData = {
                docId: window.docIdone,
                name: name,
                contact: contact,
                branch: selectedBranch, 
                contract_manager: document.getElementById('contract_manager').value || '',
                price: price,
                totalAmount: totalAmount,
                discountType: Array.from(document.querySelectorAll('input[id^="discount_"]:checked')).map(cb => cb.dataset.type).join(', ') || '',
                discount: document.getElementById('discount').value || '',
                gender: document.querySelector('input[name="gender"]:checked')?.value || '',
                payment_method: document.querySelector('input[name="payment"]:checked')?.value || '',
                // 가입경로 정보 수집
                referral_sources: Array.from(document.querySelectorAll('input[name="referral"]:checked')).map(cb => {
                    // 기본 소스 정보
                    const sourceInfo = {
                        source: cb.value
                    };

                    // SNS인 경우 detail 정보 추가
                    if (cb.value === 'SNS') {
                        const snsDetail = document.getElementById('snsField')?.value || '';
                        if (snsDetail) {
                            sourceInfo.detail = snsDetail;
                        }
                    }

                    return sourceInfo;
                }),
                timestamp: new Date().toISOString(),
                adminVerified: isAdmin ? true : false
            };

            // 새로운 폴더 구조에 맞게 문서 저장
            await setDoc(doc(dbInstance, selectedBranch, year, "Onetimepass", window.docIdone), userData);
            console.log(`✅ Firestore ${selectedBranch}/${year}/Onetimepass에 일일권 정보 저장 완료`);

            // Continue with regular membership registration...
            resolve();
        } catch (error) {
            console.error("일일권 정보 저장 중 오류 발생:", error);
            alert("일일권 정보 저장에 실패했습니다.");
            reject(error);
        }
    });
}

/* 이미지 업로드 함수 - 서명이나 계약서 이미지를 Firebase Storage에 업로드하고 URL을 Firestore에 저장 */
async function uploadImage(fileName, blob, noteText = "") { // Added noteText parameter
    try {
        const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js");
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js");

        const firebaseInstance = await initializeFirebase();
        const storage = firebaseInstance.storage;
        const db = firebaseInstance.db;

        // 현재 페이지 URL에 따라 컬렉션 이름 결정
        const isOnetime = window.location.pathname.includes('onetime.html') || window.location.pathname.includes('onetime-receipt.html');
        const collectionName = isOnetime ? "Onetimepass" : "Membership";

        // 지점 정보 가져오기
        const selectedBranch = document.getElementById('branch').value;
        const year = new Date().getFullYear().toString();

        // 페이지 기반으로 폴더 구분 (receipt.html 또는 onetime-receipt.html인 경우 Receipt, 그 외에는 Contract)
        const isReceiptPage = window.location.pathname.includes('receipt.html') || window.location.pathname.includes('onetime-receipt.html');
        const fileType = isReceiptPage ? 'Receipt' : 'Contract';

        // 파일명 생성 함수 사용
        const storageFileName = isReceiptPage ? generateReceiptFileName(window.docIdone, 1, noteText) : window.docIdone;

        console.log(`저장 경로: ${selectedBranch}/${year}/${collectionName}/${fileType}/${storageFileName}`);

        /* Firebase Storage에 이미지 업로드 - 새 폴더 구조 적용 */
        // selectedBranch는 이미 지점명 (관저점, 용문가장점)
        const storageRef = ref(storage, `${selectedBranch}/${year}/${collectionName}/${fileType}/${storageFileName}`);
        // Content-Disposition: attachment 메타데이터 추가
        const metadata = {
          contentDisposition: 'attachment'
        };
        await uploadBytes(storageRef, blob, metadata);
        console.log(`✅ Firebase Storage 업로드 완료! 경로: ${selectedBranch}/${year}/${collectionName}/${fileType}`);

        /* 업로드된 이미지의 다운로드 URL 가져오기 */
        const downloadURL = await getDownloadURL(storageRef);
        console.log("🔗 Firebase Storage 이미지 URL:", downloadURL);

        /* Firestore 문서에 이미지 URL 업데이트 */
        if (window.docIdone) {
            const docRef = doc(db, selectedBranch, year, collectionName, window.docIdone); 
            await updateDoc(docRef, { imageUrl: downloadURL });
            console.log(`✅ Firestore ${selectedBranch}/${year}/${collectionName}에 이미지 URL 저장 완료:`, downloadURL); 
        } else {
            console.error("❌ Firestore 문서 ID(window.docId)가 제공되지 않음.");
        }

        return downloadURL;
    } catch (error) {
        console.error("❌ Firebase Storage 업로드 실패:", error);
        throw error;
    }
}

window.submitOnetimeForm = submitOnetimeForm;
window.uploadImage = uploadImage;