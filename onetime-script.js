// 지점 및 매니저 데이터 로드 함수
async function loadBranchAndManagerData() {
  try {
    // 직접 Firebase 초기화 함수 가져오기
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js");
    const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js");

    // Firebase 설정 가져오기
    async function getFirebaseConfig() {
      try {
        const response = await fetch("https://us-central1-bodystar-1b77d.cloudfunctions.net/getFirebaseConfig");
        const config = await response.json();
        console.log("Firebase 설정 가져오기 성공");
        return config;
      } catch (error) {
        console.error("Firebase 설정 가져오기 오류:", error);
        throw error;
      }
    }

    // Firebase 초기화
    const firebaseConfig = await getFirebaseConfig();
    const app = initializeApp(firebaseConfig);
    const dbInstance = getFirestore(app);

    // AdminSettings/settings 문서에서 데이터 가져오기
    const settingsDocRef = doc(dbInstance, "AdminSettings", "settings");
    const settingsDocSnap = await getDoc(settingsDocRef);

    if (settingsDocSnap.exists()) {
      const settingsData = settingsDocSnap.data();

      // 지점 드롭다운 찾기
      const branchSelect = document.getElementById('branch');
      if (branchSelect) {
        // 지점 데이터 가져오기
        const branches = settingsData.branch || {};
        window.branchCodes = settingsData.branchCodes || {}; // 브랜치 코드 저장

        // 각 지점의 매니저 데이터 저장
        Object.keys(branches).forEach(branchKey => {
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
}

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

// 페이지 로드 시 지점 및 매니저 데이터 로드
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM 로드 완료 - 지점 및 매니저 데이터 로드 시작');
  loadBranchAndManagerData();
});

// 일회권 관련 자바스크립트 함수들

// 양식 제출 핸들러 함수
async function handleOnetimeSubmit() {
  try {
    // 먼저 필수 항목 검증
    validateOnetimeForm();

    // Firebase에 데이터 저장
    await window.submitOnetimeForm();

    // 이미지 생성 및 다운로드
    downloadOnetimeAsImage();
  } catch (error) {
    console.error("Error submitting form:", error);
    alert(error.message || "양식 제출 중 오류가 발생했습니다.");
  }
}

// 일회권 신청서를 이미지로 변환하고 다운로드하는 함수
function downloadOnetimeAsImage() {
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

    // Firebase 문서 번호를 사용하여 파일 이름 생성
    // 올바른 docId 형식을 유지하기 위해 window.docId 사용
    const branch = document.getElementById('branch').value; // 지점 정보 가져오기
    // 브랜치 코드 가져오기
    let branchCode = "";
    if (window.branchCodes && branch) {
        branchCode = window.branchCodes[branch] || "";
    }

    // 브랜치 코드가 없으면 기본값으로 폴백
    if (!branchCode) {
        branchCode = branch === '용문가장점' ? 'YM' : branch === '관저점' ? 'GJ' : '';
    }
    console.log(`일회권 브랜치 코드 ${branch}: ${branchCode}`);

    // 일일권 고유 문서 ID 생성 (지점코드+날짜+one_일련번호_이름)
    window.docIdone = `${branchCode}${dateStr}one_${dailyNumber}_${memberName}`; // one-time pass format
    const fileName = `${window.docIdone}.jpg`;

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
              if (!window.docIdone) {
                  alert('신청서 번호를 찾을 수 없습니다.');
                  return;
              }
              localStorage.setItem('receipt_doc_id', window.docIdone);
              localStorage.setItem('collection_name', 'Onetimepass'); // 컬렉션 이름 저장
              window.location.href = 'onetime-receipt.html';
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

// 일회권용 유효성 검사 함수
function validateOnetimeForm() {
  // 필수 입력 필드 목록
  const requiredFields = ['name', 'contact', 'branch'];

  for (const fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
      throw new Error(`필수 항목(${fieldId === 'branch' ? '지점' : fieldId === 'name' ? '이름' : '연락처'})을 입력해주세요.`);
    }
  }

  // 약관 동의 확인
  const termsAgree = document.querySelector('input[name="terms_agree"]');
  if (!termsAgree || !termsAgree.checked) {
    throw new Error('이용약관에 동의해주세요.');
  }

  // 성별 선택 확인
  const gender = document.querySelector('input[name="gender"]:checked');
  if (!gender) {
    throw new Error('성별을 선택해주세요.');
  }

  // 결제방법 선택 확인
  const payment = document.querySelector('input[name="payment"]:checked');
  if (!payment) {
    throw new Error('결제방법을 선택해주세요.');
  }

  return true;
}

// 일회권 금액 계산 함수
function calculateTotal() {
  const price = parseInt(document.getElementById('price').value.replace(/[^\d]/g, '') || 22000);
  const discount = parseInt(document.getElementById('discount').value.replace(/[^\d]/g, '') || 0);
  const total = Math.max(0, price - discount);
  document.getElementById('total_amount').value = '₩ ' + total.toLocaleString('ko-KR');

  // Update unpaid amount if using combined payment
  const unpaidField = document.getElementById('unpaid');
  if (unpaidField) {
    unpaidField.value = '';
    unpaidField.style.backgroundColor = '#f5f5f5';
  }
}

// 일회권 할인 팝업 함수
function showDiscountPopup() {
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
    min-width: 300px;
    font-size: 16px;
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

  // 팝업 제목 추가
  const titleDiv = document.createElement('div');
  titleDiv.innerHTML = '<h4 style="margin-top: 0; margin-bottom: 15px; text-align: center;">할인 항목 입력</h4>';
  popup.appendChild(titleDiv);

  const discountContainer = document.createElement('div');
  discountContainer.id = 'discount-items';
  discountContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  // 팔로우 할인 행 추가
  const followRow = document.createElement('div');
  followRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const followLabel = document.createElement('div');
  followLabel.textContent = '팔로우 할인';
  followLabel.style.cssText = `
    width: 120px;
    font-weight: bold;
  `;

  const followInput = document.createElement('input');
  followInput.type = 'text';
  followInput.style.cssText = 'width: 150px; padding: 5px; border-radius: 5px; font-size: 14px;';
  followInput.placeholder = '(₩)금액입력';
  followInput.setAttribute('inputmode', 'numeric');
  followInput.oninput = function() { formatCurrency(this); updateDiscountSummary(); };

  followRow.appendChild(followLabel);
  followRow.appendChild(followInput);
  discountContainer.appendChild(followRow);

  // 리뷰 할인 행 추가
  const reviewRow = document.createElement('div');
  reviewRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const reviewLabel = document.createElement('div');
  reviewLabel.textContent = '리뷰 할인';
  reviewLabel.style.cssText = `
    width: 120px;
    font-weight: bold;
  `;

  const reviewInput = document.createElement('input');
  reviewInput.type = 'text';
  reviewInput.style.cssText = 'width: 150px; padding: 5px; border-radius: 5px; font-size: 14px;';
  reviewInput.placeholder = '(₩)금액입력';
  reviewInput.setAttribute('inputmode', 'numeric');
  reviewInput.oninput = function() { formatCurrency(this); updateDiscountSummary(); };

  reviewRow.appendChild(reviewLabel);
  reviewRow.appendChild(reviewInput);
  discountContainer.appendChild(reviewRow);

  // 할인 요약 표시 영역 추가
  const summaryDiv = document.createElement('div');
  summaryDiv.id = 'discount-summary';
  summaryDiv.style.cssText = `
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 5px;
    border: 1px solid #dee2e6;
    font-size: 14px;
  `;
  summaryDiv.innerHTML = '<div>할인 금액 합계: ₩ 0</div>';

  function updateDiscountSummary() {
    const followAmount = parseInt(followInput.value.replace(/[^\d]/g, '')) || 0;
    const reviewAmount = parseInt(reviewInput.value.replace(/[^\d]/g, '')) || 0;
    const total = followAmount + reviewAmount;

    // 할인 상세 내역 없이 합계만 표시
    summaryDiv.innerHTML = `<div><strong>할인 합계: ₩ ${total.toLocaleString('ko-KR')}</strong></div>`;
    return total;
  }

  const confirmButton = document.createElement('button');
  confirmButton.textContent = '확인';
  confirmButton.style.cssText = `
    padding: 8px 15px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    width: 100%;
    margin-top: 15px;
  `;

  confirmButton.onclick = function() {
    const total = updateDiscountSummary();
    document.getElementById('discount').value = '₩ ' + total.toLocaleString('ko-KR');
    calculateTotal();
    document.body.removeChild(overlay);
    document.body.removeChild(popup);
  };

  popup.appendChild(discountContainer);
  popup.appendChild(summaryDiv);
  popup.appendChild(confirmButton);

  // 모달 닫기 - overlay 클릭시
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
      document.body.removeChild(popup);
    }
  });

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

// 전화번호 포맷팅 함수
function formatPhoneNumber(input) {
  let value = input.value.replace(/\D/g, ''); // 숫자만 남기기

  if (value.length >= 11) {
    value = value.substring(0, 11); // 최대 11자리로 제한
    value = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (value.length > 7) {
    value = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (value.length > 3) {
    value = value.replace(/(\d{3})(\d{1,4})/, '$1-$2');
  }

  input.value = value; // 변환된 값 설정
}

// 문서 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  // 금액 입력 필드 초기화
  const priceInput = document.getElementById('price');
  if (priceInput) {
    priceInput.readOnly = true;
    priceInput.style.backgroundColor = '#f5f5f5';
  }

  // 할인 체크박스 이벤트 리스너 초기화
  const followDiscount = document.getElementById('discount_follow');
  const reviewDiscount = document.getElementById('discount_review');

  if (followDiscount && reviewDiscount) {
    followDiscount.addEventListener('change', updateDiscounts);
    reviewDiscount.addEventListener('change', updateDiscounts);
  }

  // 초기 할인액 업데이트
  updateDiscounts();

  // 초기 합계 계산
  calculateTotal();

  // 현금영수증 관련 필드 처리
  const cashReceiptRadios = document.querySelectorAll('input[name="cash_receipt"]');
  const receiptPhoneField = document.getElementById('receipt_phone');

  if (cashReceiptRadios.length > 0 && receiptPhoneField) {
    cashReceiptRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.value === 'O') {
          receiptPhoneField.disabled = false;
          receiptPhoneField.style.backgroundColor = '';
        } else {
          receiptPhoneField.disabled = true;
          receiptPhoneField.style.backgroundColor = '#f5f5f5';
          receiptPhoneField.value = '';
        }
      });
    });

    // 초기 상태 설정
    receiptPhoneField.disabled = true;
    receiptPhoneField.style.backgroundColor = '#f5f5f5';
  }

  // SNS 필드 처리
  const snsCheckbox = document.querySelector('input[name="referral"][value="SNS"]');
  const snsField = document.getElementById('snsField');

  if (snsCheckbox && snsField) {
    snsField.style.display = 'none';
    snsCheckbox.addEventListener('change', function() {
      snsField.style.display = this.checked ? 'block' : 'none';
    });
  }
});

// 전역 함수로 내보내기
// 할인 체크박스 업데이트 함수
function updateDiscounts() {
  let totalDiscount = 0;
  let selectedDiscountType = '';

  // 모든 할인 체크박스 확인
  document.querySelectorAll('input[id^="discount_"]').forEach(checkbox => {
    if (checkbox.checked) {
      totalDiscount += parseInt(checkbox.dataset.value) || 0;
      selectedDiscountType += (selectedDiscountType ? ', ' : '') + checkbox.dataset.type;
    }
  });

  // 할인 금액과 타입 저장
  document.getElementById('discount').value = '₩ ' + totalDiscount.toLocaleString('ko-KR');
  document.getElementById('discount').dataset.type = selectedDiscountType;
  calculateTotal();
}

window.handleOnetimeSubmit = handleOnetimeSubmit;
window.validateOnetimeForm = validateOnetimeForm;
window.calculateTotal = calculateTotal;
window.formatPhoneNumber = formatPhoneNumber;
window.updateDiscounts = updateDiscounts;

function captureContractImage() {
  // 캡처할 요소 선택
  const contractElement = document.querySelector('.container');

  // html2canvas 옵션 설정
  const options = {
    scale: 2, // 고해상도 설정
    useCORS: true, // CORS 이미지 허용
    allowTaint: true, // 외부 이미지 허용
    backgroundColor: "#FFFFFF", // 흰색 배경
    width: contractElement.offsetWidth - 40, // 오른쪽 여백 줄이기
    x: 0 // 좌측에서부터 시작
  };

  // 페이지 스크롤 상태 저장
  const scrollPos = window.scrollY;

  // 스크롤을 맨 위로 이동
  window.scrollTo(0, 0);

  html2canvas(contractElement, options).then(canvas => {
    // 이미지 다운로드 또는 다른 처리 로직 추가
    const imgData = canvas.toDataURL('image/png');
    // ... (이미지 처리 로직) ...
    window.scrollTo(0, scrollPos); // 스크롤 복원
  }).catch(error => {
    console.error("html2canvas error:", error);
  });
}