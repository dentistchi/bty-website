"use client";

import { useCallback } from "react";

export function LogoutButton() {
  const onLogout = useCallback(() => {
    // middleware가 처리하는 document navigation
    window.location.assign("/bty/logout?next=%2Fbty");
  }, []);

  return (
    <button
      type="button"
      onClick={onLogout}
      className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
    >
      로그아웃
    </button>
  );
}

export default LogoutButton;
