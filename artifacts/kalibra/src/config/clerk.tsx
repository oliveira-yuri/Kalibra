import { shadcn } from '@clerk/themes';
import { publishableKeyFromHost } from '@clerk/react/internal';
import type { Theme } from '@/types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

export function buildClerkAppearance(theme: Theme) {
  return {
    theme: theme === 'dark' ? shadcn : undefined,
    cssLayerName: "clerk",
    options: {
      logoPlacement: "inside" as const,
      logoLinkUrl: basePath || "/",
      logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    },
    variables: {
      colorPrimary: "#6b8d00",
      colorBackground: theme === 'dark' ? "#131821" : "#ffffff",
      colorForeground: theme === 'dark' ? "#f0f0e8" : "#16232b",
      colorMutedForeground: theme === 'dark' ? "#8e98a8" : "#6f7b85",
      colorDanger: theme === 'dark' ? "#ff907d" : "#c94f45",
      colorInput: theme === 'dark' ? "#11161d" : "#ffffff",
      colorInputForeground: theme === 'dark' ? "#f0f0e8" : "#16232b",
      colorNeutral: theme === 'dark' ? "#34404d" : "#c4d0ce",
      fontFamily: "var(--app-font-sans)",
      borderRadius: "3px",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: theme === 'dark' 
        ? "bg-[#131821] rounded-[3px] border border-[#29313d] w-[440px] max-w-full overflow-hidden" 
        : "bg-white rounded-[3px] border border-[#d5dede] w-[440px] max-w-full overflow-hidden",
      card: "!shadow-none !border-0 !bg-transparent !rounded-none",
      footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
      headerTitle: "text-[27px] font-semibold tracking-[-.05em]",
      headerSubtitle: "text-[12px] leading-5 text-[#8e98a8]",
      socialButtonsBlockButtonText: "font-semibold text-[13px]",
      formFieldLabel: "text-[12px] font-medium mb-1",
      footerActionLink: "text-[#6b8d00] hover:text-[#5f7900]",
      footerActionText: "text-[12px]",
      dividerText: "text-[11px] uppercase tracking-wider",
      identityPreviewEditButton: "text-[#6b8d00]",
      formFieldSuccessText: "text-[#80d8a5]",
      alertText: "text-[#ff907d]",
      logoBox: "mb-6 justify-center",
      logoImage: "w-8 h-8",
      socialButtonsBlockButton: `!border ${theme === 'dark' ? '!border-[#34404d] hover:!bg-[#212a36]' : '!border-[#c4d0ce] hover:!bg-[#e9efed]'}`,
      formButtonPrimary: theme === 'dark' ? "!bg-[#d5f35b] hover:!bg-[#e2fb78] !text-[#10131a] !border-none" : "!bg-[#6b8d00] hover:!bg-[#587700] !text-white !border-none",
      formFieldInput: `!border ${theme === 'dark' ? '!border-[#34404d] !bg-[#11161d] focus:!border-[#d5f35b]' : '!border-[#c4d0ce] !bg-white focus:!border-[#6b8d00]'}`,
      footerAction: "mt-4",
      dividerLine: `${theme === 'dark' ? '!bg-[#29313d]' : '!bg-[#d5dede]'}`,
      alert: "border border-[#ff907d]",
      otpCodeFieldInput: `!border ${theme === 'dark' ? '!border-[#34404d] !bg-[#11161d]' : '!border-[#c4d0ce] !bg-white'}`,
      formFieldRow: "mb-4",
      main: "gap-4",
    },
  };
}
