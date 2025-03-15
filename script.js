// 양식 제출 핸들러 함수
async function handleSubmit() {
  try {
    // 먼저 Firebase에 데이터 저장
    await submitForm();

    // 이미지 생성 및 다운로드
    downloadAsImage();
    // ✅ Firestore에 `imageUrl`이 저장된 후 버튼 활성화
    //document.getElementById('sendKakao').style.display = 'block'; //Removed as per request
  } catch (error) {
    console.error("Error submitting form:", error);
    alert(error.message || "양식 제출 중 오류가 발생했습니다.");
  }
}

// 전역 스코프에 함수 노출
window.handleSubmit = handleSubmit;
window.downloadAsImage = downloadAsImage;

// CSS 애니메이션 추가
if (!document.querySelector('#pulse-animation')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'pulse-animation';
  styleElement.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 120, 215, 0.7); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(0, 120, 215, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 120, 215, 0); }
    }
  `;
  document.head.appendChild(styleElement);
}

// 일일권 제출 핸들러 함수
async function handleOnedaySubmit() {
  try {
    // 먼저 Firebase에 데이터 저장
    await submitOnedayForm();

    // 이미지 생성 및 다운로드
    downloadOnedayAsImage();
  } catch (error) {
    console.error("Error submitting form:", error);
    alert(error.message || "양식 제출 중 오류가 발생했습니다.");
  }
}

// 양식 유효성 검사 함수
function validateForm() {
  // 필수 입력 필드 목록
  const requiredFields = ['name', 'contact', 'birthdate', 'main_address', 'membership'];
  for (const fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
      throw new Error(`필수 항목을 모두 입력해주세요.`);
    }
  }
  return true;
}

// 계약서를 이미지로 변환하고 다운로드하는 함수
function downloadAsImage() {
  const container = document.querySelector('.container');
  html2canvas(container, {
    backgroundColor: '#f5f5f5',
    scale: 1.0,
    useCORS: true
  }).then(canvas => {
    console.log("📸 이미지 변환 완료");

    // 현재 날짜를 YYMMDD 형식으로 가져오기
    const now = new Date();
    const year = now.getFullYear().toString().slice(2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = year + month + day;

    // 회원 이름 가져오기
    const memberName = document.getElementById('name').value;

    // Firebase 제출에서 docId 가져오기
    const dailyNumber = localStorage.getItem('current_doc_number');
    if (!dailyNumber) {
      console.error('Document number not found');
      return;
    }

    // 브랜치 코드 추출 (docId에서 앞 2글자)
    const branchCode = window.docId.substring(0, 2);
    // Firebase 문서 번호를 사용하여 파일 이름 생성 (브랜치 코드 포함)
    const fileName = `${branchCode}${dateStr}_${dailyNumber}_${memberName}.jpg`;

    // 캔버스를 Blob으로 변환하고 Firebase Storage에 업로드
    canvas.toBlob(async (blob) => {
      try {
        // Firebase Storage에 이미지 업로드
        await window.uploadImage(fileName, blob);

        // 로컬 다운로드 링크 생성
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      } catch (error) {
        console.error("이미지 업로드 실패:", error);
      }
    }, 'image/jpeg');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 999;
    `;
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 40px;
      border-radius: 15px;
      box-shadow: 0 0 20px rgba(0,0,0,0.4);
      z-index: 1000;
      text-align: center;
      min-width: 300px;
      min-height: 180px;
      font-size: 16px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `;

    const statusText = document.createElement('h3');
    statusText.textContent = '계약서 업로드 중...';
    statusText.style.cssText = `
      margin-top: 0px;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      white-space: nowrap; /* 줄바꿈 방지 */
    `;
    popup.appendChild(statusText);

    setTimeout(() => {
      statusText.textContent = '계약서 업로드 완료!';
      setTimeout(() => {
        statusText.textContent = '계약서URL 저장 완료!';
        setTimeout(() => {
          statusText.style.display = 'none';

          // Create button container for vertical layout
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
          `;

          // 영수증 저장 버튼 생성
          const receiptBtn = document.createElement('button');
          receiptBtn.textContent = '영수증 저장';
          receiptBtn.onclick = function() {
              console.log("영수증 버튼 클릭됨, docId:", window.docId);
              console.log("영수증 저장 제목:", window.docId ? `${window.docId}의 영수증` : "영수증");
              if (!window.docId) {
                  alert('계약서 번호를 찾을 수 없습니다.');
                  return;
              }
              localStorage.setItem('receipt_doc_id', window.docId);
              console.log("receipt_doc_id를 localStorage에 저장:", window.docId);
              window.location.href = 'receipt.html';
          };

          // 영수증 버튼 강조를 위한 스타일 추가
          receiptBtn.style.animation = "pulse 1.5s infinite";
          receiptBtn.style.cssText = `
              padding: 10px 20px;
              background: #0078D7;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-weight: bold;
              font-size: 16px;
              width: 200px;
          `;

          // 버튼을 팝업에 추가
          buttonContainer.appendChild(receiptBtn);
          popup.appendChild(buttonContainer);

          // 콘솔에 로그 추가
          console.log("영수증 버튼이 팝업에 추가됨");


        }, 1000);
      }, 1000);
    }, 1000);

    document.body.appendChild(popup);
    console.log("🎉 팝업 생성 완료");


  }).catch(error => {
    console.error("❌ html2canvas 실행 중 오류 발생:", error);
  });
}

// 일일권 신청서를 이미지로 변환하고 다운로드하는 함수
function downloadOnedayAsImage() {
  const container = document.querySelector('.container');
  html2canvas(container, {
    backgroundColor: '#f5f5f5',
    scale: 1.0,
    useCORS: true
  }).then(canvas => {
    console.log("📸 이미지 변환 완료");

    // 현재 날짜를 YYMMDD 형식으로 가져오기
    const now = new Date();
    const year = now.getFullYear().toString().slice(2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = year + month + day;

    // 회원 이름 가져오기
    const memberName = document.getElementById('name').value;

    // Firebase 제출에서 docId 가져오기
    const dailyNumber = localStorage.getItem('current_doc_number');
    if (!dailyNumber) {
      console.error('Document number not found');
      return;
    }

    // 브랜치 코드 추출 (docId에서 앞 2글자)
    const branchCode = window.docId.substring(0, 2);
    // Firebase 문서 번호를 사용하여 파일 이름 생성 (브랜치 코드 포함)
    const fileName = `${branchCode}${dateStr}_${dailyNumber}_${memberName}.jpg`;

    // 캔버스를 Blob으로 변환하고 Firebase Storage에 업로드
    canvas.toBlob(async (blob) => {
      try {
        // Firebase Storage에 이미지 업로드
        await window.uploadImage(fileName, blob);

        // 로컬 다운로드 링크 생성
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      } catch (error) {
        console.error("이미지 업로드 실패:", error);
      }
    }, 'image/jpeg');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 999;
    `;
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 40px;
      border-radius: 15px;
      box-shadow: 0 0 20px rgba(0,0,0,0.4);
      z-index: 1000;
      text-align: center;
      min-width: 300px;
      min-height: 180px;
      font-size: 16px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `;

    const statusText = document.createElement('h3');
    statusText.textContent = '신청서 업로드 중...';
    statusText.style.cssText = `
      margin-top: 0px;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      white-space: nowrap; /* 줄바꿈 방지 */
    `;
    popup.appendChild(statusText);

    setTimeout(() => {
      statusText.textContent = '신청서 업로드 완료!';
      setTimeout(() => {
        statusText.textContent = '신청서URL 저장 완료!';
        setTimeout(() => {
          statusText.style.display = 'none';

          // Create button container for vertical layout
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
          `;

          // 영수증 저장 버튼 생성
          const receiptBtn = document.createElement('button');
          receiptBtn.textContent = '영수증 저장';
          receiptBtn.onclick = function() {
              if (!window.docId) {
                  alert('신청서 번호를 찾을 수 없습니다.');
                  return;
              }
              localStorage.setItem('receipt_doc_id', window.docId);
              localStorage.setItem('collection_name', 'Onedaypass'); // 컬렉션 이름 저장
              window.location.href = 'receipt.html';
          };
          receiptBtn.style.cssText = `
              padding: 10px 20px;
              background: #0078D7;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-weight: bold;
              font-size: 16px;
              width: 200px;
          `;

          // 버튼을 팝업에 추가
          buttonContainer.appendChild(receiptBtn);
          popup.appendChild(buttonContainer);


        }, 1000);
      }, 1000);
    }, 1000);

    document.body.appendChild(popup);
    console.log("🎉 팝업 생성 완료");


  }).catch(error => {
    console.error("❌ html2canvas 실행 중 오류 발생:", error);
  });
}

// 📌Canvas
document.addEventListener('DOMContentLoaded', function() {
  const canvas = document.querySelector(".canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const colors = document.getElementsByClassName("jsColor");

    const INITIAL_COLOR = "#000000";
    canvas.width = 180;  // Match canvas element width
    canvas.height = 50;  // Match canvas element height

    ctx.strokeStyle = "#2c2c2c";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = INITIAL_COLOR;
    ctx.fillStyle = INITIAL_COLOR;
    ctx.lineWidth = 2.5;
  }
});

// Canvas painting variables and functions
window.filling = false;
window.painting = false;

function stopPainting() {
  window.painting = false;
}

function startPainting() {
  window.painting = true;
}

function onMouseMove(event) {
  const x = event.offsetX;
  const y = event.offsetY;
  if (!window.painting) {
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else {
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const canvas = document.querySelector(".canvas");
  if (canvas) {
    canvas.addEventListener('click', function(e) {
      e.preventDefault();

      const popup = document.createElement('div');
      popup.style.cssText = `
    position: fixed;
    top: 50 %;
    left: 50 %;
    transform: translate(-50 %, -50 %);
    background: white;
    padding: 20px;
    border - radius: 10px;
    box - shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    z - index: 1000;
    font-size: 16px; /* Increased font size */
    `;

      const overlay = document.createElement('div');
      overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100 %;
    height: 100 %;
    background: rgba(0, 0, 0, 0.5);
    z - index: 999;
    `;

      const popupCanvas = document.createElement('canvas');
      popupCanvas.width = 400;
      popupCanvas.height = 200;
      popupCanvas.style.border = '1px solid #ccc';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '서명 완료';
      closeBtn.style.cssText = `
    display: block;
    margin: 10px auto 0;
    padding: 5px 20px;
    border: none;
    background: #0078D7;
    color: white;
    border - radius: 5px;
    cursor: pointer;
    font-size: 16px; /* Increased font size */
    `;

      popup.appendChild(popupCanvas);
      popup.appendChild(closeBtn);
      document.body.appendChild(overlay);
      document.body.appendChild(popup);

      const popupCtx = popupCanvas.getContext('2d');
      popupCtx.strokeStyle = '#000000';
      popupCtx.lineWidth = 2;
      popupCtx.lineCap = 'round';

      let isDrawing = false;
      let lastX = 0;
      let lastY = 0;

      function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const rect = popupCanvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        popupCtx.beginPath();
        popupCtx.moveTo(lastX, lastY);
        popupCtx.lineTo(x, y);
        popupCtx.stroke();
        [lastX, lastY] = [x, y];
      }

      popupCanvas.addEventListener('mousedown', function(e) {
        isDrawing = true;
        const rect = popupCanvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
      });

      popupCanvas.addEventListener('mousemove', draw);
      popupCanvas.addEventListener('mouseup', () => isDrawing = false);
      popupCanvas.addEventListener('mouseleave', () => isDrawing = false);

      popupCanvas.addEventListener('touchstart', function(e) {
        isDrawing = true;
        const rect = popupCanvas.getBoundingClientRect();
        lastX = e.touches[0].clientX - rect.left;
        lastY = e.touches[0].clientY - rect.top;
      });

      popupCanvas.addEventListener('touchmove', draw);
      popupCanvas.addEventListener('touchend', () => isDrawing = false);

      closeBtn.addEventListener('click', () => {
        // Copy signature to original canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(popupCanvas, 0, 0, canvas.width, canvas.height);
        document.body.removeChild(overlay);
        document.body.removeChild(popup);
      });
    });
  }
});

function sendit() {
  const name = document.getElementById('name'); // 이름
  const contact = document.getElementById('contact'); // 연락처
  const birthdate = document.getElementById('birthdate'); // 생년월일
  const membership = document.getElementById('membership'); // 회원권 선택
  const rentalMonths = document.getElementById('rental_months'); // 운동복 대여 개월수
  const lockerMonths = document.getElementById('locker_months'); // 라커 대여 개월수
  const exerciseGoals = document.getElementsByName('goal'); // 운동목적
  const otherGoal = document.getElementById('other'); // 기타 입력 칸
  const paymentMethods = document.getElementsByName('payment'); // 결제 방법
  const zipcode = document.getElementById('sample6_postcode'); // 주소
  const referralSources = document.getElementsByName('referral'); // 가입경로 

  // 정규식
  const expNameText = /^[가-힣]+$/;
  const expContactText = /^\d{3}-\d{4}-\d{4}$/; // 연락처 형식 체크

  if (name.value == '') {
    alert('이름을 입력하세요');
    name.focus();
    return false;
  }

  if (!/^[가-힣]{2,5}$/.test(name.value)) {
    alert('이름을 한글로 입력해주세요');
    name.focus();
    return false;
  }

  if (contact.value == '') {
    alert('연락처를 입력하세요');
    contact.focus();
    return false;
  }

  if (!expContactText.test(contact.value)) { // 연락처 형식 체크
    alert('연락처 형식을 확인하세요 (예: 000-0000-0000)');
    contact.focus();
    return false;
  }


  if (membership.value == '') {
    alert('회원권 선택을 해주세요');
    membership.focus();
    return false;
  }

  if (rentalMonths.value == '' || rentalMonths.value < 1) {
    alert('운동복 대여 개월수를 입력해주세요');
    rentalMonths.focus();
    return false;
  }

  if (lockerMonths.value == '' || lockerMonths.value < 0) {
    alert('라커 대여 개월수를 입력해주세요');
    lockerMonths.focus();
    return false;
  }

  let count = 0;

  for (let i in exerciseGoals) {
    if (exerciseGoals[i].checked) {
      count++;
    }
  }

  if (count == 0) {
    alert('운동목적을 선택하세요');
    return false;
  }

  // 기타 항목 체크
  if (otherGoal.value.trim() !== '') {
    count++;
  }

  // 결제 방법 체크
  let paymentSelected = false;
  for (let i in paymentMethods) {
    if (paymentMethods[i].checked) {
      paymentSelected = true;
      break;
    }
  }

  if (!paymentSelected) {
    alert('결제 방법을 선택하세요');
    return false;
  }


  // 가입경로 체크
  let referralSelected = false;
  for (let i in referralSources) {
    if (referralSources[i].checked) {
      referralSelected = true;
      break;
    }
  }

  if (!referralSelected) {
    alert('가입경로를 선택하세요');
    return false;
  }

  if (zipcode.value == '') {
    alert('주소를 입력하세요');
    zipcode.focus();
    return false;
  }

  return true;
}

function formatBirthdate(input) {
  let value = input.value.replace(/\D/g, '');

  if (value.length === 6) {
    value = '19' + value;
  }

  if (value.length === 8) {
    const year = value.substring(0, 4);
    const month = value.substring(4, 6);
    const day = value.substring(6, 8);
    input.value = `${year} -${month} -${day} `;
  }
}

function moveFocus() {
  const ssn1 = document.getElementById('ssn1');
  if (ssn1.value.length >= 6) {
    document.getElementById('ssn2').focus();
  }
}

function formatPhoneNumber(input) {
  let value = input.value.replace(/\D/g, ''); // 숫자만 남기기

  if (value.length >= 11) {
    value = value.substring(0, 11); // 최대 11자리로 제한
    value = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (value.length > 7) {
    value = value.replace(/(\d{3})(\d{4})/, '$1-$2');
  } else if (value.length > 3) {
    value = value.replace(/(\d{3})/, '$1-');
  }

  input.value = value; // 변환된 값 설정
}

// 📌 운동시간 체크
function handleTimeSelect(select) {
  const checkbox = select.parentElement.querySelector('input[type="checkbox"][name="workout_time"]');
  if (select.value !== "") {
    checkbox.checked = true;
  } else {
    checkbox.checked = false;
  }
}

function handleWorkoutTimeChange(checkbox) {
  const select = checkbox.parentElement.querySelector('select[data-workout-time]');
  if (!checkbox.checked) {
    select.value = ""; // 체크 해제 시 드롭다운 값을 비움
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const timeSelects = document.querySelectorAll('select[data-workout-time]');
  timeSelects.forEach(select => {
    select.addEventListener('change', () => handleTimeSelect(select));
  });

  const checkboxes = document.querySelectorAll('input[type="checkbox"][name="workout_time"]');

// 페이지 로드 시 
document.addEventListener('DOMContentLoaded', function() {
  // 다른 DOMContentLoaded 이벤트 핸들러와 충돌하지 않도록 기존 함수 호출
  const existingCanvasElement = document.querySelector(".canvas");
  if (existingCanvasElement) {
    // 이미 존재하는 canvas 초기화 로직 실행 (기존 코드 유지)
  }
});

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => handleWorkoutTimeChange(checkbox));
  });
});


// 📌 전화번호 입력 필드에서 자동 변환 적용
document.addEventListener("DOMContentLoaded", function() {
  const phoneInput = document.getElementById("contact");
  if (phoneInput) {
    // Get phone from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const phone = urlParams.get('phone');
    if (phone) {
      phoneInput.value = phone;
      phoneInput.readOnly = true;
      phoneInput.style.backgroundColor = '#f5f5f5';
    }

    phoneInput.addEventListener("input", function() {
      formatPhoneNumber(this);
    });
  }
});


// 복합결제 payment popup
function updatePaymentSummary() {
  const paymentSummary = document.getElementById('payment-summary');
  const paymentItems = document.querySelectorAll('#payment-items input');
  const unpaidField = document.getElementById('unpaid');
  const totalAmountStr = document.getElementById('total_amount').value;
  const totalAmount = parseInt(totalAmountStr.replace(/[^\d]/g, '')) || 0;

  let summaryHtml = '';
  let total = 0;

  paymentItems.forEach((input, index) => {
    if (index % 2 === 0) { // Description input
      const description = input.value;
      const amount = paymentItems[index + 1]?.value || '0';
      if (description && amount) {
        const numAmount = parseInt(amount.replace(/[^\d]/g, '')) || 0;
        total += numAmount;
        summaryHtml += `<div>${description}: ${amount}</div>`;
      }
    }
  });

  if (paymentSummary) {
    if (summaryHtml) {
      summaryHtml += `<div style="margin-top: 8px; border-top: 1px solid #ccc; padding-top: 8px;"><strong>결제완료: ${total.toLocaleString('ko-KR')}원</strong></div>`;
      paymentSummary.innerHTML = summaryHtml;

      // Calculate and update unpaid amount
      const unpaidAmount = totalAmount - total;
      if (unpaidField) {
        unpaidField.value = '결제예정 ₩' + (unpaidAmount > 0 ? unpaidAmount.toLocaleString('ko-KR') : '0');
        unpaidField.style.backgroundColor = unpaidAmount > 0 ? '#ffebeb' : '#f5f5f5';
      }
    }
  }
}

function showCardPaymentPopup() {
    // Remove existing popup and overlay if they exist
    const existingPopup = document.querySelector('.payment-popup');
    const existingOverlay = document.querySelector('.payment-overlay');
    if (existingPopup) document.body.removeChild(existingPopup);
    if (existingOverlay) document.body.removeChild(existingOverlay);

    const popup = document.createElement('div');
    popup.className = 'payment-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 0 20px rgba(0,0,0,0.3);
      z-index: 1000;
      min-width: 300px;
      font-size: 16px; /* Increased font size */
    `;

    const overlay = document.createElement('div');
    overlay.className = 'payment-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 999;
    `;

    const paymentContainer = document.createElement('div');
    paymentContainer.id = 'payment-items';
    paymentContainer.style.marginBottom = '20px';

    // Total amount display
    const totalDisplay = document.createElement('div');
    totalDisplay.style.cssText = `
      margin-top: 20px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 5px;
      text-align: right;
      font-weight: bold;
      font-size: 16px; /* Increased font size */
    `;
    totalDisplay.textContent = '합계: ₩ 0';

    function addPaymentRow(description = '', isReadOnly = false, isFaded = false) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        align-items: center;
      `;

      const addBtn = document.createElement('button');
      addBtn.innerHTML = '+';
      addBtn.style.cssText = `
        width: 30px;
        height: 30px;
        border-radius: 4px;
        border: none;
        background: #4CAF50;
        color: white;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      addBtn.onclick = function() { 
        addPaymentRow(); 
      };

      const descInput = document.createElement('input');
      descInput.type = 'text';
      descInput.style.cssText = 'width: 150px; padding: 5px; border-radius: 5px; border: 1px solid #ccc; font-size: 16px;';
      descInput.placeholder = '결제 내용';
      if (description) {
        descInput.value = description;
      }

      // Apply read-only and faded styling if needed
      if (isReadOnly) {
        descInput.readOnly = true;
        descInput.style.backgroundColor = '#f5f5f5';
      }

      if (isFaded) {
        descInput.style.color = '#aaa';
        descInput.style.fontStyle = 'italic';

        // Add focus and input event listeners to handle placeholder behavior
        descInput.addEventListener('focus', function() {
          if (this.value === '(직접입력)') {
            this.value = '';
            this.style.color = '#000';
            this.style.fontStyle = 'normal';
          }
        });

        descInput.addEventListener('blur', function() {
          if (this.value === '') {
            this.value = '(직접입력)';
            this.style.color = '#aaa';
            this.style.fontStyle = 'italic';
          }
        });

        descInput.addEventListener('input', function() {
          this.style.color = '#000';
          this.style.fontStyle = 'normal';
        });
      }

      const amountInput = document.createElement('input');
      amountInput.type = 'text';
      amountInput.style.cssText = 'width: 150px; padding: 5px; border-radius: 5px; border: 1px solid #ccc; font-size: 16px;';
      amountInput.placeholder = '(₩)금액입력';
      amountInput.setAttribute('inputmode', 'numeric');
      amountInput.oninput = function() {
        formatCurrency(this);
        updateTotal();
      };
      amountInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
          confirmButton.click();
        }
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '×';
      deleteBtn.style.cssText = `
        width: 30px;
        height: 30px;
border-radius: 4px;
        border: none;
        background: #ff4444;
        color: white;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      deleteBtn.onclick = function() {
        row.remove();
        updateTotal();
      };

      row.appendChild(addBtn);
      row.appendChild(descInput);
      row.appendChild(amountInput);
      row.appendChild(deleteBtn);
      paymentContainer.appendChild(row);
    }

    function updateTotal() {
      let total = 0;
      paymentContainer.querySelectorAll('input[type="text"]:nth-child(3)').forEach(input => {
        const value = parseInt(input.value.replace(/[^\d]/g, '')) || 0;
        total += value;
      });
      totalDisplay.textContent = '합계: ₩ ' + total.toLocaleString('ko-KR');
    }

    const confirmButton = document.createElement('button');
    confirmButton.textContent = '확인';
    confirmButton.style.cssText = `
      padding: 8px 20px;
      background: #0078D7;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      float: right;
      font-size: 16px; /* Increased font size */
    `;

    confirmButton.onclick = function() {
      updatePaymentSummary();
      const popup = document.querySelector('.payment-popup');
      const overlay = document.querySelector('.payment-overlay');
      if (popup) document.body.removeChild(popup);
      if (overlay) document.body.removeChild(overlay);
      
      // Uncheck the combined payment radio if needed
      const combinedPaymentRadio = document.querySelector('input[type="radio"][value="복합결제"]');
      if (combinedPaymentRadio) {
        combinedPaymentRadio.checked = false;
      }
    };

    popup.appendChild(paymentContainer);
    popup.appendChild(totalDisplay);
    popup.appendChild(confirmButton);
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Add default payment options
    addPaymentRow('카드', true);
    addPaymentRow('현금', true);
    addPaymentRow('계좌이체', true);
  }

// Add discount popup functionality
function showDiscountPopup() {
  const existingPopup = document.querySelector('.payment-popup');
  const existingOverlay = document.querySelector('.payment-overlay');
  if (existingPopup) document.body.removeChild(existingPopup);
  if (existingOverlay) document.body.removeChild(existingOverlay);

  const popup = document.createElement('div');
  popup.className = 'payment-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    z-index: 1000;
    min-width: 300px;
    font-size: 16px;
  `;

  const overlay = document.createElement('div');
  overlay.className = 'payment-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 999;
  `;

  const discountContainer = document.createElement('div');
  discountContainer.id = 'discount-items';
  discountContainer.style.marginBottom = '20px';

  // Total amount display
  const totalDisplay = document.createElement('div');
  totalDisplay.style.cssText = `
    margin-top: 20px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 5px;
    text-align: right;
    font-weight: bold;
    font-size: 16px;
  `;
  totalDisplay.textContent = '할인 합계: ₩ 0';

  function addDiscountRow(description = '', isReadOnly = false, isFaded = false) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      align-items: center;
    `;

    const addBtn = document.createElement('button');
    addBtn.innerHTML = '+';
    addBtn.style.cssText = `
      width: 30px;
      height: 30px;
      border-radius: 4px;
      border: none;
      background: #4CAF50;
      color: white;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    addBtn.onclick = function() {
      addDiscountRow();
    };

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.style.cssText = 'width: 150px; padding: 5px; border-radius: 5px; border: 1px solid #ccc; font-size: 16px;';
    descInput.placeholder = '할인 내용';
    if (description) {
      descInput.value = description;
    }

    if (isReadOnly) {
      descInput.readOnly = true;
      descInput.style.backgroundColor = '#f5f5f5';
    }

    const amountInput = document.createElement('input');
    amountInput.type = 'text';
    amountInput.style.cssText = 'width: 150px; padding: 5px; border-radius: 5px; border: 1px solid #ccc; font-size: 16px;';
    amountInput.placeholder = '(₩)금액입력';
    amountInput.setAttribute('inputmode', 'numeric');
    amountInput.oninput = function() {
      formatCurrency(this);
      updateTotal();
    };
    amountInput.onkeypress = function(e) {
      if (e.key === 'Enter') {
        confirmButton.click();
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '×';
    deleteBtn.style.cssText = `
      width: 30px;
      height: 30px;
      border-radius: 4px;
      border: none;
      background: #ff4444;
      color: white;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    deleteBtn.onclick = function() {
      row.remove();
      updateTotal();
    };

    row.appendChild(addBtn);
    row.appendChild(descInput);
    row.appendChild(amountInput);
    row.appendChild(deleteBtn);
    discountContainer.appendChild(row);
  }

  function updateTotal() {
    let total = 0;
    discountContainer.querySelectorAll('input[type="text"]:nth-child(3)').forEach(input => {
      const value = parseInt(input.value.replace(/[^\d]/g, '')) || 0;
      total += value;
    });
    totalDisplay.textContent = '할인 합계: ₩ ' + total.toLocaleString('ko-KR');
  }

  const confirmButton = document.createElement('button');
  confirmButton.textContent = '확인';
  confirmButton.style.cssText = `
    padding: 8px 20px;
    background: #0078D7;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    float: right;
    font-size: 16px;
  `;

  confirmButton.onclick = function() {
    let total = 0;
    discountContainer.querySelectorAll('input[type="text"]:nth-child(3)').forEach(input => {
      const value = parseInt(input.value.replace(/[^\d]/g, '')) || 0;
      total += value;
    });

    const discountInput = document.getElementById('discount');
    if (discountInput) {
      discountInput.value = '₩ ' + total.toLocaleString('ko-KR');
      calculateTotal();
    }

    document.body.removeChild(overlay);
    document.body.removeChild(popup);
  };

  popup.appendChild(discountContainer);
  popup.appendChild(totalDisplay);
  popup.appendChild(confirmButton);
  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  // Add default discount rows
  addDiscountRow('운동복 할인', true);
  addDiscountRow('라커 할인', true);
  addDiscountRow('직접입력', false, true);
}

// Make showDiscountPopup available globally
window.showDiscountPopup = showDiscountPopup;

// Remove any existing event listeners
document.removeEventListener('DOMContentLoaded', function() {
  const discountInput = document.getElementById('discount');
  if (discountInput) {
    discountInput.removeEventListener('click', showDiscountPopup);
  }
});

// Add event listener for card checkbox
document.addEventListener('DOMContentLoaded', function() {
  const combinedPaymentRadio = document.querySelector('input[type="radio"][value="복합결제"]');
  if (combinedPaymentRadio) {
    combinedPaymentRadio.addEventListener('change', function() {
      if (this.checked) {
        showCardPaymentPopup();
      }
    });
  }

  // Add null checks for other elements before adding event listeners
  const membershipSelect = document.getElementById('membership');
  const rentalMonthsSelect = document.getElementById('rental_months');
  const lockerMonthsSelect = document.getElementById('locker_months');
  const membershipMonthsSelect = document.getElementById('membership_months');
  const discountInput = document.getElementById('discount');

  if (membershipSelect) {
    membershipSelect.addEventListener('change', updateAdmissionFee);
  }
  if (rentalMonthsSelect) {
    rentalMonthsSelect.addEventListener('change', () => updateRentalPrice(rentalMonthsSelect));
  }
  if (lockerMonthsSelect) {
    lockerMonthsSelect.addEventListener('change', () => updateLockerPrice(lockerMonthsSelect));
  }
  if (membershipMonthsSelect) {
    membershipMonthsSelect.addEventListener('change', () => updateMembershipFee(membershipMonthsSelect));
  }
  if (discountInput) {
    discountInput.addEventListener('input', calculateTotal);
  }

  // Only calculate total if elements exist
  if (document.getElementById('total_amount')) {
    calculateTotal(); // Initial calculation
  }
});

// 📌 회원권 가격
function updateAdmissionFee() {
  const membershipSelect = document.getElementById("membership");
  const admissionFeeInput = document.getElementById("admission_fee");

  if (!membershipSelect || !admissionFeeInput) return;

  let fee = '₩ 0';
  if (membershipSelect.value === "New") {
    const newFee = window.membershipFees?.new || 330001;
    fee = '₩ ' + newFee.toLocaleString('ko-KR');
  } else if (membershipSelect.value === "Renew") {
    const renewFee = window.membershipFees?.renew || 0;
    fee = '₩ ' + renewFee.toLocaleString('ko-KR');
  } else if (membershipSelect.value === "Upgrade") {
    const upgradeFee = window.membershipFees?.upgrade || 0;
    fee = '₩ ' + upgradeFee.toLocaleString('ko-KR');
  }

  admissionFeeInput.value = fee.toLocaleString("ko-KR");
  admissionFeeInput.style.backgroundColor = "#f5f5f5";
  admissionFeeInput.readOnly = true;
  calculateTotal(); // Added to update total on membership change
}


// 📌 운동복 가격
function updateRentalPrice(select) {
  const rentalPrice = document.getElementById('rental_price');
  if (rentalPrice) {
    if (select.value) {
      const monthlyFee = 11000;
      const total = parseInt(select.value) * monthlyFee;
      rentalPrice.value = '₩ ' + total.toLocaleString('ko-KR');
    } else {
      rentalPrice.value = '₩ 0';
    }
    calculateTotal();
  }
}

// 📌 라커 가격
function updateLockerPrice(select) {
  const lockerPrice = document.getElementById('locker_price');
  if (lockerPrice) {
    if (select.value) {
      const monthlyFee = window.lockerPrice || 11000;
      const total = parseInt(select.value) * monthlyFee;
      lockerPrice.value = '₩ ' + total.toLocaleString('ko-KR');
    } else {
      lockerPrice.value = '₩ 0';
    }
    calculateTotal();
  }
}

// 📌 기간회비 가격
function updateMembershipFee(select) {
  const membershipFee = document.getElementById('membership_fee');
  if (membershipFee) {
    let fee = 0;
    switch (parseInt(select.value)) {
      case 1: fee = 99000; break;
      case 2: fee = 154000; break;
      case 3: fee = 198000; break;
      case 6: fee = 297000; break;
      case 12: fee = 429000; break;
      default: fee = 0;
    }
    membershipFee.value = '₩ ' + fee.toLocaleString('ko-KR');
    calculateTotal(); // Added to update total on membership fee change
  }
}


function formatCurrency(input) {
  let value = input.value.replace(/[^\d]/g, "");
  value = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(value);
  value = value.replace("₩", "").trim();
  input.value = value;
}

// Function already exists elsewhere in the file

function calculateTotal() {
  const admissionFee = parseInt(document.getElementById('admission_fee').value.replace(/[^\d]/g, '') || 0);
  const rentalPrice = parseInt(document.getElementById('rental_price').value.replace(/[^\d]/g, '') || 0);
  const lockerPrice = parseInt(document.getElementById('locker_price').value.replace(/[^\d]/g, '') || 0);
  const membershipFee = parseInt(document.getElementById('membership_fee').value.replace(/[^\d]/g, '') || 0);
  const discount = parseInt(document.getElementById('discount').value.replace(/[^\d]/g, '') || 0);

  const total = admissionFee + rentalPrice + lockerPrice + membershipFee - discount;
  const totalAmount = document.getElementById('total_amount');
  const unpaidField = document.getElementById('unpaid');

  totalAmount.value = '₩ ' + total.toLocaleString('ko-KR');

  // ✅ combinedPaymentRadio를 함수 맨 위에서 선언하여 전체 함수에서 사용 가능하도록 변경
  const combinedPaymentRadio = document.querySelector('input[type="radio"][value="복합결제"]');

  let unpaidAmount = 0;
  let combinedPaymentTotal = 0;

  if (combinedPaymentRadio && combinedPaymentRadio.checked) {
    combinedPaymentTotal = getCombinedPaymentTotal();
    unpaidAmount = total - combinedPaymentTotal;
    unpaidField.value = '결제예정 ₩' + (unpaidAmount > 0 ? unpaidAmount.toLocaleString('ko-KR') : '0');
    unpaidField.style.backgroundColor = unpaidAmount > 0 ? '#ffebeb' : '#f5f5f5';
  } else {
    unpaidField.value = '';
    unpaidField.style.backgroundColor = '#f5f5f5';
  }

  // 🎯 콘솔 로그 추가 (복합결제 시 결제예정 금액 계산 포함)
  console.log(`🎯 Total Calculation: ${admissionFee} + ${rentalPrice} + ${lockerPrice} + ${membershipFee} - ${discount} = ${total}`);
  console.log(`💳 Combined Payment: ${combinedPaymentRadio && combinedPaymentRadio.checked ? combinedPaymentTotal.toLocaleString('ko-KR') : 'N/A'}`);
  console.log(`📝 Unpaid Amount: ${unpaidAmount.toLocaleString('ko-KR')} 원`);
}


document.addEventListener('DOMContentLoaded', function() {
  const membershipSelect = document.getElementById('membership');
  const rentalMonthsSelect = document.getElementById('rental_months');
  const lockerMonthsSelect = document.getElementById('locker_months');
  const membershipMonthsSelect = document.getElementById('membership_months');
  const discountInput = document.getElementById('discount');

  // Only add event listeners if the elements exist (membership page)
  if (membershipSelect) {
    membershipSelect.addEventListener('change', updateAdmissionFee);
  }
  if (rentalMonthsSelect) {
    rentalMonthsSelect.addEventListener('change', () => updateRentalPrice(rentalMonthsSelect));
  }
  if (lockerMonthsSelect) {
    lockerMonthsSelect.addEventListener('change', () => updateLockerPrice(lockerMonthsSelect));
  }
  if (membershipMonthsSelect) {
    membershipMonthsSelect.addEventListener('change', () => updateMembershipFee(membershipMonthsSelect));
  }
  if (discountInput) {
    discountInput.addEventListener('input', calculateTotal);
  }

  // Only calculate total if we're on a page that has total_amount element
  if (document.getElementById('total_amount')) {
    calculateTotal(); // Initial calculation
  }
});

function getCombinedPaymentTotal() {
  const paymentItems = document.querySelectorAll('#payment-items input');
  let total = 0;
  paymentItems.forEach((input, index) => {
    if (index % 2 === 0) {
      const amount = paymentItems[index + 1]?.value || '0';
      if (amount) {
        const numAmount = parseInt(amount.replace(/[^\d]/g, '')) || 0;
        total += numAmount;
      }
    }
  });
  return total;
}
// 📌 운동복 대여 가격
function updateRentalPrice(select) {
  const months = parseInt(select.value) || 0;
  const rentalPriceInput = document.getElementById('rental_price');

  if (!rentalPriceInput) return;

  if (months > 0) {
    // Firebase에서 가져온 운동복 대여 월별 가격(기본값 110001)
    const basePrice = window.rentalPrice || 110001;
    const price = basePrice * months;
    rentalPriceInput.value = '₩ ' + price.toLocaleString('ko-KR');
  } else {
    rentalPriceInput.value = '₩ 0';
  }

  calculateTotal();
}

// 📌 라커 대여 가격
function updateLockerPrice(select) {
  const months = parseInt(select.value) || 0;
  const lockerPriceInput = document.getElementById('locker_price');

  if (!lockerPriceInput) return;

  if (months > 0) {
    // Firebase에서 가져온 라커 대여 월별 가격(기본값 110001)
    const basePrice = window.lockerPrice || 110001;
    const price = basePrice * months;
    lockerPriceInput.value = '₩ ' + price.toLocaleString('ko-KR');
  } else {
    lockerPriceInput.value = '₩ 0';
  }

  calculateTotal();
}

// 📌 기간회비 가격
function updateMembershipFee(select) {
  const months = parseInt(select.value) || 0;
  const membershipFeeInput = document.getElementById('membership_fee');

  if (!membershipFeeInput) return;

  if (months > 0) {
    // Firebase에서 가져온 월별 회원권 가격
    const price = window.membershipPrices?.[months] || 0;
    membershipFeeInput.value = '₩ ' + price.toLocaleString('ko-KR');
  } else {
    membershipFeeInput.value = '₩ 0';
  }

  calculateTotal();

// 환불 계산 함수 - Firestore에서 가져온 정상가격 활용
function calculateRefund(membershipType, usedDays, totalPaid, services = {}) {
  if (!window.normalPrices) {
    console.warn("정상가격 정보를 찾을 수 없습니다. 기본값을 사용합니다.");
    window.normalPrices = {
      dailyPrice: 5000,
      freePTPrice: 50000,
      gxPrice: 30000
    };
  }

  // 위약금 계산 (총 금액의 10%)
  const penalty = totalPaid * 0.1;

  // 이용 일수에 따른 사용 금액 계산
  const dailyUsage = usedDays * window.normalPrices.dailyPrice;

  // 서비스 제공 항목 계산
  let serviceAmount = 0;
  if (services.freePT) {
    serviceAmount += services.freePT * window.normalPrices.freePTPrice;
  }
  if (services.gx) {
    serviceAmount += services.gx * window.normalPrices.gxPrice;
  }

  // 환불 금액 = 총 결제액 - 위약금 - 이용 금액 - 서비스 제공 금액
  const refundAmount = totalPaid - penalty - dailyUsage - serviceAmount;

  return {
    totalPaid: totalPaid,
    penalty: penalty,
    dailyUsage: dailyUsage,
    serviceAmount: serviceAmount,
    refundAmount: Math.max(0, refundAmount)
  };
}

// 환불 계산 예시를 보여주는 팝업
function showRefundCalculationExample() {
  if (!window.normalPrices) {
    // Firestore에서 아직 로드되지 않은 경우
    return;
  }

  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 500px;
    font-size: 16px;
  `;

  popup.innerHTML = `
    <h3 style="margin-top: 0; text-align: center;">환불 계산 예시</h3>
    <p>3개월 등록 회원이 30일 사용 후 환불 요청 시:</p>
    <ul>
      <li>총 결제액: 198,000원</li>
      <li>위약금(10%): 19,800원</li>
      <li>이용 금액: ${window.normalPrices.dailyPrice.toLocaleString('ko-KR')}원 × 30일 = ${(window.normalPrices.dailyPrice * 30).toLocaleString('ko-KR')}원</li>
      <li>무료 PT 1회 사용: ${window.normalPrices.freePTPrice.toLocaleString('ko-KR')}원</li>
      <li>최종 환불액: 78,200원</li>
    </ul>
    <div style="text-align: center; margin-top: 20px;">
      <button id="close-popup" style="padding: 8px 20px; background: #0078D7; color: white; border: none; border-radius: 5px; cursor: pointer;">닫기</button>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 999;
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  document.getElementById('close-popup').addEventListener('click', function() {
    document.body.removeChild(overlay);
    document.body.removeChild(popup);
  });
}


}
// Admin code button is already in HTML, no need to include it here in JavaScript

function createDiscountRow(discountType) {
  const row = document.createElement('div');
  row.style.marginBottom = '10px';
  row.style.display = 'flex';
  row.style.gap = '10px';
  row.style.alignItems = 'center';

  const label = document.createElement('label');
  label.textContent = discountType + ':';
  label.style.fontWeight = 'bold';

  const input = document.createElement('input');
  input.type = 'text';
  input.style.cssText = 'width: 150px; padding: 5px; border-radius: 5px; font-size: 16px;';
  input.placeholder = '(₩)금액입력';
  input.setAttribute('inputmode', 'numeric');
  input.oninput = function() { formatCurrency(this); };

  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '×';
  deleteBtn.style.cssText = `
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: none;
    background: #ff4444;
    color: white;
    cursor: pointer;
  `;
  deleteBtn.onclick = function() { row.remove(); calculateTotal(); };

  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(deleteBtn);
  discountContainer.appendChild(row);
}

function addDiscountRow(discountType = '') {
  const row = document.createElement('div');
  row.style.marginBottom = '10px';
  row.style.display = 'flex';
  row.style.gap = '10px';
  row.style.alignItems = 'center';

  const label = document.createElement('label');
  label.textContent = discountType || '할인';
  label.style.fontWeight = 'bold';
  label.style.width = '120px';

  const input = document.createElement('input');
  input.type = 'text';
  input.style.cssText = 'flex: 1; padding: 5px; border-radius: 5px; font-size: 16px;';
  input.placeholder = '(₩)금액입력';
  input.setAttribute('inputmode', 'numeric');
  input.oninput = function() { formatCurrency(this); };

  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '×';
  deleteBtn.style.cssText = `
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: none;
    background: #ff4444;
    color: white;
    cursor: pointer;
  `;
  deleteBtn.onclick = function() { row.remove(); calculateTotal(); };

  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(deleteBtn);
  discountContainer.appendChild(row);
}