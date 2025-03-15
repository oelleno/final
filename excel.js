// Firebase SDK 불러오기
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { ref, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js";
import { db, storage } from "./firebase.js";

// Firebase 설정이 로드되었는지 확인하는 함수
async function ensureFirebaseInitialized() {
  try {
    const dbInstance = await db;
    const storageInstance = await storage;
    return { db: dbInstance, storage: storageInstance };
  } catch (error) {
    console.error("Firebase 초기화 상태 확인 중 오류:", error);
    throw error;
  }
}

// 엑셀 파일명 설정
const fileName = "contract.xlsx";

// 버튼 클릭 시 실행되는 함수
export async function excelupload() {
  const uploadBtn = document.getElementById("excel-upload-btn");
  uploadBtn.textContent = "최종업로드중...";
  uploadBtn.disabled = true;

  try {
    // Firestore에서 특정 문서 가져오기
    const dbInstance = await db;

    // 문서 ID에서 브랜치 코드 추출 (예: GJ250313 -> GJ)
    const branchCode = window.docId.substring(0, 2);
    console.log(`엑셀 데이터 조회: 문서 ID에서 추출한 브랜치 코드: ${branchCode}`);

    // 브랜치 코드를 기반으로 올바른 지점명 결정
    let branchStr = '';
    if (branchCode === 'GJ') {
      branchStr = '관저점';
    } else if (branchCode === 'YM') {
      branchStr = '용문가장점';
    } else {
      // 브랜치 선택요소에서 지점명 가져오기 (폴백)
      branchStr = localStorage.getItem('branch') || '관저점';
    }
    console.log(`엑셀 데이터 조회: 지점명: ${branchStr} (코드: ${branchCode})`);

    const year = new Date().getFullYear().toString(); // 현재 연도 (2025부터 시작)
    const docRef = doc(dbInstance, branchStr, year, "Membership", window.docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error("문서를 찾을 수 없습니다:", window.docId);

      // 기본 ID 추출 (예: Y250313_001_소피아 -> Y250313_001)
      const baseDocId = window.docId.split('_').slice(0, 2).join('_');
      if (baseDocId !== window.docId) {
        console.log(`${window.docId} 대신 기본 ID ${baseDocId}로 재시도합니다.`);
        // 기본 ID로 문서 참조 생성
        const baseDocRef = doc(dbInstance, branch, year, "Membership", baseDocId);
        const baseDocSnap = await getDoc(baseDocRef);

        if (baseDocSnap.exists()) {
          console.log(`기본 ID ${baseDocId}로 문서를 찾았습니다.`);
          // 기본 ID 문서가 존재하면 해당 문서 사용
          window.docId = baseDocId; // docId 업데이트
          // userData 할당은 이 조건문 아래에서 처리됨
          docSnap = baseDocSnap; // docSnap 업데이트
        } else {
          const statusElement = document.getElementById("status");
          if (statusElement) {
            statusElement.innerText = "문서를 찾을 수 없습니다!";
          } else {
            alert(`문서를 찾을 수 없습니다: ${window.docId}`);
          }

          const uploadBtn = document.getElementById("excel-upload-btn");
          if (uploadBtn) {
            uploadBtn.textContent = "문서 없음";
            uploadBtn.disabled = false;
          }
          return;
        }
      } else {
        const statusElement = document.getElementById("status");
        if (statusElement) {
          statusElement.innerText = "문서를 찾을 수 없습니다!";
        } else {
          alert(`문서를 찾을 수 없습니다: ${window.docId}`);
        }

        const uploadBtn = document.getElementById("excel-upload-btn");
        if (uploadBtn) {
          uploadBtn.textContent = "문서 없음";
          uploadBtn.disabled = false;
        }
        return;
      }
    }
    // Firestore에서 가져온 데이터 매핑
    const userData = docSnap.data();

    // receipts 배열이 존재하는지 확인
    if (userData.receipts && userData.receipts.length > 0) {
      userData.receipts.forEach((receipt, index) => {
        console.log(`영수증 ${index + 1} URL:`, receipt.url);
      });
    } else {
      console.warn("영수증 URL이 없습니다.");
    }

    const formatURLAsHyperlink = (url) => url ? { t: "l", v: url, l: { Target: url } } : { t: "s", v: "" };

    const newData = [[
      userData.docId || "N/A",
      userData.branch || "N/A",
      userData.contract_manager || "N/A",
      userData.name || "N/A",
      userData.contact || "N/A",
      userData.gender || "N/A",
      userData.birthdate || "N/A",
      userData.address || "N/A",
      userData.membership || "N/A",
      userData.rental_months || "N/A",
      userData.locker_months || "N/A",
      userData.membership_months || "N/A",
      userData.discount || "N/A",
      userData.totalAmount || "N/A",
      userData.payment_method || "N/A",
      userData.unpaid ? userData.unpaid.replace('결제예정 ', '') : "N/A",
      userData.goals ? userData.goals.join(", ") : "N/A",
      userData.other_goal || "N/A",
      userData.workout_times ? `${userData.workout_times.start}-${userData.workout_times.end} ${userData.workout_times.additional || ''}` : "N/A",
      userData.referral_sources ? userData.referral_sources.map(ref =>
        ref.source + (ref.detail ? `: ${typeof ref.detail === 'object' ? `${ref.detail.name}(${ref.detail.phone})` : ref.detail}` : '')
      ).join(', ') : "N/A",
      userData.membership_start_date || "N/A",
      userData.timestamp || "N/A",
      formatURLAsHyperlink(userData.imageUrl),
      formatURLAsHyperlink(userData.receipts?.[0]?.url),
      formatURLAsHyperlink(userData.receipts?.[1]?.url),
      formatURLAsHyperlink(userData.receipts?.[2]?.url),
      formatURLAsHyperlink(userData.receipts?.[3]?.url),
      formatURLAsHyperlink(userData.receipts?.[4]?.url),
      formatURLAsHyperlink(userData.receipts?.[5]?.url)
    ]];


    // 기존 엑셀 파일 가져오기
    let workbook;
    let existingData = [];
    const sheetName = "회원가입계약서"; // 변경된 시트 이름
    const headerRow = [
      "ID", "지점", "계약담당자", "이름", "연락처", "성별",
      "생년월일", "주소", "회원권", "운동복대여", "라커대여",
      "기간", "할인", "합계", "결제방법", "결제예정",
      "운동목적", "기타목적", "운동시간", "가입경로", "시작일",
      "등록일시", "계약서사본", "영수증1", "영수증2", "영수증3", "영수증4", "영수증5", "영수증6"
    ];

    try {
      const storageInstance = await storage;
      const fileRef = ref(storageInstance, fileName);
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const data = await response.arrayBuffer();

      // 기존 엑셀 파일 읽기
      workbook = XLSX.read(data, { type: "array" });

      // "회원가입" 시트가 있으면 데이터를 유지
      if (workbook.SheetNames.includes(sheetName)) {
        const worksheet = workbook.Sheets[sheetName];
        existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      }

    } catch (error) {
      console.warn("기존 엑셀 파일 없음. 새 파일 생성.");
      workbook = XLSX.utils.book_new();
    }

    // 기존 데이터가 없으면 헤더 추가
    if (existingData.length === 0) {
      existingData.push(headerRow);
    } else {
      // 빈 행 제거
      existingData = existingData.filter(row => row.some(cell => cell !== undefined && cell !== ""));
    }

    // 기존 데이터의 마지막 행에 새로운 데이터 추가
    existingData.push(...newData);

    // 새 엑셀 워크시트 생성
    const newWorksheet = XLSX.utils.aoa_to_sheet(existingData, { cellDates: true });
    // 하이퍼링크 속성 유지
    existingData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (typeof cell === "object" && cell.l) {
          newWorksheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })] = cell;
        }
      });
    });
    // Enable hyperlinks in the worksheet
    if (!newWorksheet['!cols']) newWorksheet['!cols'] = [];
    for (let i = 22; i <= 28; i++) {
      newWorksheet['!cols'][i] = { wch: 15 }; // Set column width for hyperlink columns
    }

    // 기존 시트를 유지하면서 "회원가입" 시트를 추가하거나 덮어쓰기
    if (workbook.SheetNames.includes(sheetName)) {
      workbook.Sheets[sheetName] = newWorksheet;
    } else {
      XLSX.utils.book_append_sheet(workbook, newWorksheet, sheetName);
    }

    // 엑셀 파일을 Blob으로 변환 후 업로드
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    try {
      const storageInstance = await storage;
      console.log("스토리지 인스턴스 가져오기 성공:", storageInstance);

      // docId에서 브랜치 코드 추출 (예: YM250313 -> YM)
      const branchCode = window.docId.substring(0, 2);
      console.log(`엑셀 저장 브랜치 코드: ${branchCode}`);
      const year = new Date().getFullYear().toString();

      // 문서 ID의 브랜치 코드에 해당하는 올바른 지점명 찾기
      let branchStr = '';
      // branchCode(GJ)를 기반으로 올바른 지점명(관저점) 매핑
      if (branchCode === 'GJ') {
        branchStr = '관저점';
      } else if (branchCode === 'YM') {
        branchStr = '용문가장점';
      } else {
        // 브랜치 선택요소에서 지점명 가져오기 (폴백)
        const branchElement = document.getElementById('branch');
        branchStr = branchElement ? branchElement.value : '';
      }
      console.log(`엑셀 저장 지점: ${branchStr} (코드: ${branchCode})`);

      // 기본 스토리지 루트에 파일 저장 (폴더 구조 없음)
      const fileRef = ref(storageInstance, `${fileName}`);
      console.log("엑셀 파일 저장 경로 (기본 스토리지):", `${fileName}`);
      await uploadBytesResumable(fileRef, blob);
      console.log("엑셀 파일 업로드 성공!");
    } catch (uploadError) {
      console.error("엑셀 파일 업로드 중 오류:", uploadError);
      throw uploadError;
    }

    const uploadBtn = document.getElementById("excel-upload-btn");
    uploadBtn.textContent = "최종업로드완료!";
    uploadBtn.disabled = true;
    uploadBtn.classList.remove("blink-border"); // 반짝임 효과 제거
    console.log("✅ 엑셀 업데이트가 성공적으로 완료되었습니다!");

    // 모든 작업 완료 여부 확인 - 부모창의 함수 호출
    if (window.parent && window.parent.checkAllActionsCompleted) {
      window.parent.checkAllActionsCompleted();
    }
  } catch (error) {
    console.error("엑셀 업데이트 오류:", error);

    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.innerText = "엑셀 업데이트 실패!";
    } else {
      alert("엑셀 업데이트에 실패했습니다: " + error.message);
    }

    const uploadBtn = document.getElementById("excel-upload-btn");
    if (uploadBtn) {
      uploadBtn.textContent = "업로드 실패";
      uploadBtn.disabled = false;
    }
  }
};