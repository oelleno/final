import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { ref, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js";
import { db, storage } from "./onetime-firebase.js";
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

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

const fileName = "contract.xlsx";

const formatURLAsHyperlink = (url) => url ? { t: "l", v: url, l: { Target: url } } : { t: "s", v: "" };

// docId 형식 확인 함수 - "YYMMDDone_NNN_NAME" 형식인지 확인
function isValidOnetimeDocId(docIdone) {
  const pattern = /^\d{6}one_\d{3}_.*$/;
  return pattern.test(docIdone);
}

/* Excel 업로드 함수 - 일일권 데이터를 Excel 파일로 가공하여 Firebase Storage에 업로드 */
export async function excelupload() {
  const uploadBtn = document.getElementById("excel-upload-btn");
  uploadBtn.textContent = "최종업로드중...";
  uploadBtn.disabled = true;

  try {
    // 전역 window.docIdone 변수 확인
    if (!window.docIdone) {
      console.error("docIdone이 정의되지 않았습니다. localStorage에서 확인합니다.");
      window.docIdone = localStorage.getItem('receipt_doc_id');

      if (!window.docIdone) {
        console.error("localStorage에서도 docIdone을 찾을 수 없습니다.");
        alert("계약서 ID를 찾을 수 없습니다. 페이지를 새로고침하거나 다시 시도해주세요.");
        uploadBtn.textContent = "업로드 실패";
        uploadBtn.disabled = false;
        return;
      }
    }

    console.log("사용 중인 docIdone:", window.docIdone);

    /* Firestore에서 일일권 정보 문서 가져오기 */
    const dbInstance = await db;

    // 지점 정보 추출 - docIdone의 첫 글자를 기준으로 지점 결정 (Y: 용문가장점, 나머지: 관저점)
    let branch;
    if (!window.docIdone) {
      console.error("docIdone이 정의되지 않았습니다.");
      branch = '관저점'; // 문서 ID가 없는 경우 기본값 설정 (에러 방지용)
    } else {
      const firstChar = window.docIdone.charAt(0);
      branch = firstChar === 'Y' ? '용문가장점' : '관저점';
    }

    // 반드시 변수에 할당하고 로그로 출력
    const currentYear = new Date().getFullYear().toString();
    const collection = "Onetimepass";

    console.log("🔍 문서 접근 정보:", {
      docId: window.docIdone,
      firstChar: window.docIdone ? window.docIdone.charAt(0) : 'none',
      branch: branch,
      year: currentYear,
      collection: collection,
      fullPath: `${branch}/${currentYear}/${collection}/${window.docIdone}`
    });

    // 경로 설정: 지점/연도/Onetimepass/docIdone
    const docRef = doc(dbInstance, branch, currentYear, collection, window.docIdone);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error("문서를 찾을 수 없습니다:", window.docIdone);

      // 자세한 오류 정보 로깅
      const attemptedPath = `${branch}/${currentYear}/Onetimepass/${window.docIdone}`;
      console.log("시도한 경로:", attemptedPath);

      // 다른 경로도 시도해보고 결과 로깅 (디버깅 용)
      const otherBranch = branch === '용문가장점' ? '관저점' : '용문가장점';
      console.log("대체 경로 시도:", `${otherBranch}/${currentYear}/Onetimepass/${window.docIdone}`);

      // 사용자에게 더 자세한 오류 메시지 표시
      alert(`문서를 찾을 수 없습니다!\n경로: ${attemptedPath}\n문서 ID: ${window.docIdone}`);

      const uploadBtn = document.getElementById("excel-upload-btn");
      uploadBtn.textContent = "업로드 실패";
      uploadBtn.disabled = false;
      return;
    }
    const userData = docSnap.data();

    /* 영수증 URL 로깅 (디버깅용) */
    if (userData.receipts && userData.receipts.length > 0) {
      userData.receipts.forEach((receipt, index) => {
        console.log(`영수증 ${index + 1} URL:`, receipt.url);
      });
    } else {
      console.warn("영수증 URL이 없습니다.");
    }

    /* Excel 데이터 행 생성 - 일일권 정보를 Excel 형식으로 가공 */
    const newData = [[
      window.docIdone || userData.docId || "N/A",
      userData.branch || "N/A",
      userData.contract_manager || "N/A",
      userData.name || "N/A",
      userData.contact || "N/A",
      userData.gender || "N/A",
      userData.price || "N/A",
      userData.discount || "N/A",
      userData.totalAmount || "N/A",
      userData.payment_method || "N/A",
      userData.referral_sources ? userData.referral_sources.map(ref =>
        ref.source + (ref.detail ? `: ${ref.detail}` : '')
      ).join(', ') : "N/A",
      userData.timestamp || "N/A",
    formatURLAsHyperlink(userData.imageUrl),
    formatURLAsHyperlink(userData.receipts?.[0]?.url),
    formatURLAsHyperlink(userData.receipts?.[1]?.url) ]];

    let workbook;
    let existingData = [];
    const sheetName = "1회이용권";

    /* Excel 헤더 행 설정 */
    const headerRow = [
      "ID", "지점", "계약담당자", "이름", "연락처", "성별",
      "금액", "할인", "합계", "결제방법", "가입경로",
      "등록일시", "계약서사본", "영수증1", "영수증2"
    ];

    try {
      /* 기존 Excel 파일이 있다면 가져오기 */
      const storageInstance = await storage;

      // 지점과 상관없이 스토리지 기본 폴더에서 파일 가져오기
      const fileRef = ref(storageInstance, fileName);
      console.log("기존 엑셀 파일 경로 (스토리지 기본 폴더):", fileName);

      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const data = await response.arrayBuffer();

      workbook = XLSX.read(data, { type: "array" });

      if (workbook.SheetNames.includes(sheetName)) {
        const worksheet = workbook.Sheets[sheetName];
        existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      }

    } catch (error) {
      console.warn("기존 엑셀 파일 없음. 새 파일 생성.");
      workbook = XLSX.utils.book_new();
    }

    /* 데이터 처리 및 새 데이터 행 추가 */
    if (existingData.length === 0) {
      existingData.push(headerRow);
    } else {
      existingData = existingData.filter(row => row.some(cell => cell !== undefined && cell !== ""));
    }

    existingData.push(...newData);

    /* 새 워크시트 생성 및 열 너비 설정 */
    const newWorksheet = XLSX.utils.aoa_to_sheet(existingData, { cellDates: true });
    // 하이퍼링크 속성 유지
    existingData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (typeof cell === "object" && cell.l) {
          newWorksheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })] = cell;
        }
      });
    });
    if (!newWorksheet['!cols']) newWorksheet['!cols'] = [];
    for (let i = 12; i <= 14; i++) {
      newWorksheet['!cols'][i] = { wch: 15 };
    }

    /* 워크북에 워크시트 추가 또는 업데이트 */
    if (workbook.SheetNames.includes(sheetName)) {
      workbook.Sheets[sheetName] = newWorksheet;
    } else {
      XLSX.utils.book_append_sheet(workbook, newWorksheet, sheetName);
    }

    /* Excel 파일 생성 및 Firebase Storage에 업로드 */
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const storageInstance = await storage;
    try {
      // 지점과 상관없이 스토리지 기본 폴더에 저장
      const fileRef = ref(storageInstance, fileName);
      console.log("파일 경로 (스토리지 기본 폴더):", fileName);

      await uploadBytesResumable(fileRef, blob);
      console.log("Excel 파일 업로드 성공!");
    } catch (uploadError) {
      console.error("Excel 파일 업로드 실패:", uploadError);
      throw uploadError;
    }

    /* 업로드 성공 처리 */
    const uploadBtn = document.getElementById("excel-upload-btn");
    uploadBtn.textContent = "최종업로드완료!";
    uploadBtn.disabled = true;
    uploadBtn.classList.remove("blink-border");
    console.log("✅ 엑셀 업데이트가 성공적으로 완료되었습니다!");

    /* 모든 작업이 완료되었는지 확인 */
    if (window.parent && window.parent.checkAllActionsCompleted) {
      window.parent.checkAllActionsCompleted();
    }
  } catch (error) {
    console.error("엑셀 업데이트 오류:", error);
    alert("엑셀 업데이트에 실패했습니다: " + error.message);
    const uploadBtn = document.getElementById("excel-upload-btn");
    uploadBtn.textContent = "최종업로드 실패";
    uploadBtn.disabled = false;
  }
}

export async function onetimeExcelUpload() {
  const uploadBtn = document.getElementById("excel-upload-btn");
  uploadBtn.textContent = "최종업로드중...";
  uploadBtn.disabled = true;

  try {
    // Firestore에서 특정 문서 가져오기
    const dbInstance = await db;
    const branch = document.getElementById('branch').value;
    const year = new Date().getFullYear().toString();
    const docRef = doc(dbInstance, branch, year, "Onetimepass", window.docIdone);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error("문서를 찾을 수 없습니다:", window.docIdone);
      document.getElementById("status").innerText = "문서를 찾을 수 없습니다!";
      return;
    }

    // Firestore에서 가져온 데이터 매핑
    const userData = docSnap.data();

    const newData = [[
      userData.docId || "N/A",
      userData.branch || "N/A",
      userData.contract_manager || "N/A",
      userData.name || "N/A",
      userData.contact || "N/A",
      userData.gender || "N/A",
      userData.price || "N/A",
      userData.discount || "N/A",
      userData.totalAmount || "N/A",
      userData.payment_method || "N/A",
      userData.referral_sources ? userData.referral_sources.map(ref =>
        ref.source + (ref.detail ? `: ${typeof ref.detail === 'object' ? `${ref.detail.name}(${ref.detail.phone})` : ref.detail}` : '')
      ).join(', ') : "N/A",
      userData.timestamp || "N/A",
      userData.imageUrl || ""
    ]];

    // 기존 엑셀 파일 가져오기
    let workbook;
    let existingData = [];
    const sheetName = "일일권"; // 시트 이름
    const headerRow = [
      "ID", "지점", "계약담당자", "이름", "연락처", "성별",
      "이용권가격", "할인", "합계", "결제방법", "가입경로",
      "등록일시", "계약서사본"
    ];

    try {
      const storageInstance = await storage;

      // 지점과 상관없이 스토리지 기본 폴더에서 파일 가져오기
      const fileRef = ref(storageInstance, fileName);
      console.log("기존 엑셀 파일 경로 (스토리지 기본 폴더):", fileName);

      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const data = await response.arrayBuffer();

      // 기존 엑셀 파일 읽기
      workbook = XLSX.read(data, { type: "array" });

      // 시트가 있으면 데이터를 유지
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
    for (let i = 12; i <= 12; i++) {
      newWorksheet['!cols'][i] = { wch: 15 }; // Set column width for hyperlink columns
    }

    // 기존 시트를 유지하면서 시트를 추가하거나 덮어쓰기
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

      // 지점과 상관없이 스토리지 기본 폴더에 저장
      const fileRef = ref(storageInstance, fileName);
      console.log("파일 경로 (스토리지 기본 폴더):", fileName);

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
    document.getElementById("status").innerText = "엑셀 업데이트 실패!";
  }
}