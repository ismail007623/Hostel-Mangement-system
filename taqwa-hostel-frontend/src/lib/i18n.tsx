/* Language (English default, Urdu toggle).
   Urdu uses Noto Nastaliq Urdu and right-to-left layout. The choice
   is stored in localStorage so it survives a reload. */

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ur";

const STRINGS = {
  en: {
    home: "Home",
    seats: "Seats",
    rooms: "Rooms",
    facilities: "Facilities",
    about: "About",
    apply: "Apply",
    login: "Login",
    logout: "Logout",
    backHome: "Back to home",
    heroTitle: "A safe, comfortable home near UMT",
    heroSub:
      "Taqwa Boys Hostel, Johar Town Lahore — clean rooms, honest rent, and live seat availability. Walking distance from UMT.",
    heroApply: "Apply on WhatsApp",
    heroCall: "Call the hostel",
    liveSeats: "Live seat availability",
    liveSeatsSub: "These numbers come straight from the hostel system — no old or guessed numbers.",
    noSeatsYet: "Seats are not added to the system yet. Please call Qari Sahib for the latest seats.",
    couldNotLoadSeats: "Seat numbers could not be loaded right now. Please call the hostel for the latest seats.",
    vacant: "vacant",
    total: "total",
    roomTypes: "Rooms and rent",
    roomTypesSub: "Rent is per person, every month. Starting rent is Rs 8,000 a month.",
    startingFrom: "Starting from",
    perMonth: "a month, per person",
    facilitiesTitle: "Facilities",
    aboutTitle: "About Taqwa Boys Hostel",
    aboutText:
      "Taqwa Boys Hostel is in Gulshan-e-Mustafa, Block C2 Phase 1, Johar Town, Lahore — a short walk from UMT. It has four buildings with 2, 3 and 4-seater rooms, for students and for people working in Johar Town. The hostel is open 24 hours, with a guard and a gate from 6:00 AM to 12:00 AM, plus a night-shift gate for employees.",
    founderTitle: "Founder & Manager",
    founderName: "Qari Abdul Majeed",
    founderText:
      "Qari Sahib has run the hostel for years and kept every record in his diary. This system was built for him — so he can see every resident, every room, and every rent payment without opening the diary.",
    stepsTitle: "How to join — 4 steps",
    step1: "Apply on WhatsApp or fill the form below",
    step2: "Fill your name, father name, CNIC and phone numbers",
    step3: "Qari Sahib approves and gives you a room and seat",
    step4: "Pay security and your first rent, then move in",
    locationTitle: "Where we are",
    address: "5 UMT Rd, Block C2 Phase 1, Johar Town, Lahore 54770",
    openMap: "Open in Google Maps",
    open24: "Open 24 hours",
    applyTitle: "Apply for a seat",
    applySub: "Fill this form. Qari Sahib will check it and give you a room. Login starts only after approval.",
    fullName: "Full name",
    fatherName: "Father name",
    phone: "Phone number",
    guardianPhone: "Guardian phone number",
    cnic: "CNIC number",
    password: "Password",
    passwordHint: "Choose a password for your login after approval.",
    startDate: "Start date",
    monthlyRent: "Monthly rent (Rs)",
    securityPaid: "Security paid (Rs)",
    submit: "Submit application",
    submitted: "Application submitted. Qari Sahib will check it and contact you.",
    loginTitle: "Login",
    loginSub: "One login for everyone. The system decides if you are the admin or a resident.",
    loginButton: "Log in",
    wrongLogin: "Wrong phone or password. Please try again.",
    approvalPending: "Your application is still waiting for approval. Please contact Qari Sahib.",
    admin: "Admin",
    resident: "Resident",
    dashboard: "Dashboard",
    residents: "Residents",
    applications: "Applications",
    rent: "Rent",
    payments: "Payments",
    editRequests: "Edit requests",
    settings: "Settings",
    myRoom: "My room",
    payRent: "Pay rent",
    rentHistory: "Rent history",
    editProfile: "Edit profile",
    totalResidents: "Total residents",
    vacantSeats: "Vacant seats",
    occupiedSeats: "Occupied seats",
    buildings: "Buildings",
    paidThisMonth: "Paid this month",
    dueCount: "Due now",
    overdueCount: "Overdue",
    loading: "Loading…",
    tryAgain: "Something went wrong. Please try again.",
    save: "Save",
    saved: "Saved.",
    approve: "Approve",
    reject: "Reject",
    reason: "Reason",
    due: "Due",
    dueSoon: "Due soon",
    overdue: "Overdue",
    paid: "Paid",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    remindWhatsApp: "Remind on WhatsApp",
    viewScreenshot: "View screenshot",
  },
  ur: {
    home: "ہوم",
    seats: "سیٹیں",
    rooms: "کمرے",
    facilities: "سہولتیں",
    about: "ہمارے بارے میں",
    apply: "درخواست دیں",
    login: "لاگ ان",
    logout: "لاگ آؤٹ",
    backHome: "ہوم پر واپس",
    heroTitle: "یو ایم ٹی کے قریب محفوظ اور آرام دہ گھر",
    heroSub:
      "تقویٰ بوائز ہاسٹل، جوہر ٹاؤن لاہور — صاف کمرے، ایماندار کرایہ، اور خالی سیٹوں کی تازہ معلومات۔ یو ایم ٹی سے پیدل فاصلے پر۔",
    heroApply: "واٹس ایپ پر درخواست دیں",
    heroCall: "ہاسٹل کو کال کریں",
    liveSeats: "خالی سیٹوں کی تازہ معلومات",
    liveSeatsSub: "یہ نمبر سیدھے ہاسٹل کے سسٹم سے آتے ہیں — پرانے یا اندازے کے نمبر نہیں۔",
    noSeatsYet: "سیٹیں ابھی سسٹم میں نہیں ڈالی گئیں۔ تازہ سیٹوں کے لیے قاری صاحب کو کال کریں۔",
    couldNotLoadSeats: "سیٹوں کے نمبر ابھی نہیں مل سکے۔ تازہ سیٹوں کے لیے ہاسٹل کو کال کریں۔",
    vacant: "خالی",
    total: "کل",
    roomTypes: "کمرے اور کرایہ",
    roomTypesSub: "کرایہ ہر شخص کے حساب سے ہے، ہر مہینے۔ شروعاتی کرایہ 8,000 روپے مہینہ ہے۔",
    startingFrom: "شروع",
    perMonth: "مہینہ، فی شخص",
    facilitiesTitle: "سہولتیں",
    aboutTitle: "تقویٰ بوائز ہاسٹل کے بارے میں",
    aboutText:
      "تقویٰ بوائز ہاسٹل گلشنِ مصطفیٰ، بلاک سی ٹو فیز 1، جوہر ٹاؤن، لاہور میں ہے — یو ایم ٹی سے پیدل فاصلے پر۔ اس کے چار بلڈنگز ہیں، 2، 3 اور 4 افراد کے کمرے، طلبہ اور جوہر ٹاؤن میں کام کرنے والوں کے لیے۔ ہاسٹل 24 گھنٹے کھلا رہتا ہے، چوکیدار اور گیٹ صبح 6 بجے سے رات 12 بجے تک، اور ملازمین کے لیے نائٹ شفٹ گیٹ بھی ہے۔",
    founderTitle: "بانی اور منتظم",
    founderName: "قاری عبدالمجید",
    founderText:
      "قاری صاحب برسوں سے ہاسٹل چلا رہے ہیں اور ہر حساب اپنی ڈائری میں لکھتے ہیں۔ یہ سسٹم انہی کے لیے بنایا گیا ہے — تاکہ وہ ہر رہائشی، ہر کمرہ اور ہر کرایہ ڈائری کھولے بغیر دیکھ سکیں۔",
    stepsTitle: "داخلے کے 4 مراحل",
    step1: "واٹس ایپ پر درخواست دیں یا نیچے فارم بھریں",
    step2: "اپنا نام، والد کا نام، شناختی کارڈ اور فون نمبر لکھیں",
    step3: "قاری صاحب منظوری دے کر کمرہ اور سیٹ دیں گے",
    step4: "سیکیورٹی اور پہلا کرایہ دیں، پھر رہنا شروع کریں",
    locationTitle: "ہم کہاں ہیں",
    address: "5 یو ایم ٹی روڈ، بلاک سی ٹو فیز 1، جوہر ٹاؤن، لاہور 54770",
    openMap: "گوگل میپس میں کھولیں",
    open24: "24 گھنٹے کھلا",
    applyTitle: "سیٹ کے لیے درخواست دیں",
    applySub: "یہ فارم بھریں۔ قاری صاحب دیکھ کر کمرہ دیں گے۔ لاگ ان منظوری کے بعد ہی شروع ہوگا۔",
    fullName: "پورا نام",
    fatherName: "والد کا نام",
    phone: "فون نمبر",
    guardianPhone: "سرپرست کا فون نمبر",
    cnic: "شناختی کارڈ نمبر",
    password: "پاس ورڈ",
    passwordHint: "منظوری کے بعد لاگ ان کے لیے پاس ورڈ چنیں۔",
    startDate: "شروع کی تاریخ",
    monthlyRent: "ماہانہ کرایہ (روپے)",
    securityPaid: "سیکیورٹی ادا شدہ (روپے)",
    submit: "درخواست بھیجیں",
    submitted: "درخواست مل گئی۔ قاری صاحب دیکھ کر آپ سے رابطہ کریں گے۔",
    loginTitle: "لاگ ان",
    loginSub: "سب کے لیے ایک ہی لاگ ان۔ سسٹم خود طے کرے گا کہ آپ منتظم ہیں یا رہائشی۔",
    loginButton: "لاگ ان کریں",
    wrongLogin: "فون یا پاس ورڈ غلط ہے۔ دوبارہ کوشش کریں۔",
    approvalPending: "آپ کی درخواست ابھی منظوری کے انتظار میں ہے۔ قاری صاحب سے رابطہ کریں۔",
    admin: "منتظم",
    resident: "رہائشی",
    dashboard: "ڈیش بورڈ",
    residents: "رہائشی",
    applications: "درخواستیں",
    rent: "کرایہ",
    payments: "ادائیگیاں",
    editRequests: "تبدیلی کی درخواستیں",
    settings: "ترتیبات",
    myRoom: "میرا کمرہ",
    payRent: "کرایہ ادا کریں",
    rentHistory: "کرایہ کی تاریخ",
    editProfile: "پروفائل بدلیں",
    totalResidents: "کل رہائشی",
    vacantSeats: "خالی سیٹیں",
    occupiedSeats: "بھری سیٹیں",
    buildings: "بلڈنگز",
    paidThisMonth: "اس مہینے ادا شدہ",
    dueCount: "ابھی واجب",
    overdueCount: "دیر سے",
    loading: "لوڈ ہو رہا ہے…",
    tryAgain: "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔",
    save: "محفوظ کریں",
    saved: "محفوظ ہو گیا۔",
    approve: "منظور کریں",
    reject: "مسترد کریں",
    reason: "وجہ",
    due: "واجب",
    dueSoon: "جلد واجب",
    overdue: "دیر سے",
    paid: "ادا شدہ",
    pending: "زیرِ غور",
    approved: "منظور شدہ",
    rejected: "مسترد شدہ",
    remindWhatsApp: "واٹس ایپ پر یاد دہانی",
    viewScreenshot: "اسکرین شاٹ دیکھیں",
  },
} as const;

export type Strings = Record<keyof (typeof STRINGS)["en"], string>;

interface LangCtx {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Strings;
}

const Ctx = createContext<LangCtx>({
  lang: "en",
  setLang: () => undefined,
  t: STRINGS.en,
});

export function useLang(): LangCtx {
  return useContext(Ctx);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("taqwa-lang");
    if (saved === "ur" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "ur" ? "ur" : "en";
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
    window.localStorage.setItem("taqwa-lang", lang);
  }, [lang]);

  return (
    <Ctx.Provider
      value={{
        lang,
        setLang: setLangState,
        t: STRINGS[lang],
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
