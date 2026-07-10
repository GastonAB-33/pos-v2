import { useEffect, useMemo, useState } from "react";

type DeviceKind = "mobile" | "tablet" | "desktop";
type Orientation = "portrait" | "landscape";

interface DeviceProfile {
  width: number;
  height: number;
  deviceKind: DeviceKind;
  orientation: Orientation;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
}

const getProfile = (): DeviceProfile => {
  if (typeof window === "undefined") {
    return {
      width: 1280,
      height: 720,
      deviceKind: "desktop",
      orientation: "landscape",
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
    };
  }

  const width = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
  const isTouchDevice =
    window.matchMedia?.("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0;
  const deviceKind: DeviceKind =
    width < 768 ? "mobile" : width < 1180 ? "tablet" : "desktop";

  return {
    width,
    height,
    deviceKind,
    orientation: width >= height ? "landscape" : "portrait",
    isMobile: deviceKind === "mobile",
    isTablet: deviceKind === "tablet",
    isDesktop: deviceKind === "desktop",
    isTouchDevice,
  };
};

export const useDeviceProfile = (): DeviceProfile => {
  const [profile, setProfile] = useState<DeviceProfile>(() => getProfile());

  useEffect(() => {
    const update = () => setProfile(getProfile());

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.device = profile.deviceKind;
    root.dataset.orientation = profile.orientation;
    root.dataset.touch = profile.isTouchDevice ? "true" : "false";
  }, [profile.deviceKind, profile.isTouchDevice, profile.orientation]);

  return useMemo(() => profile, [profile]);
};
