
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { db } from "./onetime-firebase.js";

// 1회 이용권 설정 로드 함수
async function loadOnetimeSettings() {
  try {
    // Firestore에서 설정 가져오기
    const dbInstance = await db;
    const docRef = doc(dbInstance, "AdminSettings", "onetimepass");
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.warn("1회 이용권 설정을 찾을 수 없습니다.");
      return;
    }

    const settings = docSnap.data();
    console.log("✅ 1회 이용권 설정 로드 완료:", settings);

    // 1회 이용권 기본 가격 설정
    if (settings.onetimepass) {
      const priceField = document.getElementById('price');
      const basePrice = settings.onetimepass.replace(/[^\d]/g, '');
      priceField.value = '₩ ' + parseInt(basePrice).toLocaleString('ko-KR');
      window.basePrice = parseInt(basePrice);
      
      // 이용 주의사항의 가격도 업데이트
      const noticePrice = document.getElementById('notice-price');
      if (noticePrice) {
        noticePrice.textContent = parseInt(basePrice).toLocaleString('ko-KR') + '원';
      }
    }

    // 할인 항목 설정
    if (settings.discount) {
      setupDiscounts(settings.discount);
    }

    // 가입경로 항목 설정
    if (settings.route) {
      setupRoutes(settings.route);
    }

    // 초기 합계 계산
    calculateTotal();

  } catch (error) {
    console.error("1회 이용권 설정 로드 오류:", error);
  }
}

// 할인 항목 설정
function setupDiscounts(discounts) {
  // 기존 할인 체크박스 컨테이너 찾기
  const discountContainer = document.querySelector('.section [id="follow_discount"]').closest('div');
  
  if (!discountContainer) {
    console.error("할인 컨테이너를 찾을 수 없습니다.");
    return;
  }

  // 컨테이너 초기화
  discountContainer.innerHTML = '';

  // 할인 항목 추가
  Object.entries(discounts).forEach(([key, value]) => {
    const discountValue = value.replace(/[^\d]/g, '');
    
    const label = document.createElement('label');
    label.style.cssText = 'font-size: 13px; display: flex; align-items: center; gap: 3px;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `discount_${key}`;
    checkbox.dataset.type = key;
    checkbox.dataset.value = discountValue;
    checkbox.onchange = updateDiscounts;
    
    const span = document.createElement('span');
    span.textContent = `${key} ₩${parseInt(discountValue).toLocaleString('ko-KR')}`;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    discountContainer.appendChild(label);
  });
}

// 가입경로 항목 설정
function setupRoutes(routes) {
  // 기존 가입경로 컨테이너 찾기
  const routeContainer = document.querySelector('.referral');
  
  if (!routeContainer) {
    console.error("가입경로 컨테이너를 찾을 수 없습니다.");
    return;
  }
  
  // 컨테이너 초기화
  routeContainer.innerHTML = '';
  
  // 가입경로 항목 추가
  Object.entries(routes).forEach(([index, value]) => {
    const label = document.createElement('label');
    label.style.cssText = 'font-size: 13px; white-space: nowrap;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'referral';
    checkbox.value = value;
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${value}`));
    routeContainer.appendChild(label);
  });
}

// 할인 적용 함수
function updateDiscounts() {
  let totalDiscount = 0;
  
  // 모든 할인 체크박스 확인
  document.querySelectorAll('input[id^="discount_"]').forEach(checkbox => {
    if (checkbox.checked) {
      totalDiscount += parseInt(checkbox.dataset.value || 0);
    }
  });
  
  // 할인 합계 설정
  document.getElementById('discount').value = '₩ ' + totalDiscount.toLocaleString('ko-KR');
  
  // 최종 금액 계산
  calculateTotal();
}

// 문서 로드 완료 시 설정 로드
document.addEventListener('DOMContentLoaded', loadOnetimeSettings);

// 전역 함수로 내보내기
window.updateDiscounts = updateDiscounts;
