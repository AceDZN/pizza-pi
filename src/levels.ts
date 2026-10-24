import type { Order, Stock } from './rules';

export type CustomerId = 'noa' | 'saba' | 'kids';

export interface TicketDef {
  id: string;
  customer: CustomerId;
  order: Order;
  /** Hebrew order text. Numbers and formulas go inside {{…}} and render as LTR spans. */
  text: string;
}

export interface LevelDef {
  id: string;
  title: string;
  topic: string;
  intro: string;
  tickets: TicketDef[];
  stock: Stock;
  hints: boolean;
  shiftSeconds?: number;
  /** Level 4: the regular's usual pie, ghosted inside the new one. */
  ghost?: { r: number; sauce: number };
}

const S = (dough: number, sauce: number, cheese = 0, flour = 0, water = 0): Stock => ({ dough, sauce, cheese, flour, water });

export const LEVELS: LevelDef[] = [
  {
    id: 'L1-first-pie',
    title: 'הפיצה הראשונה',
    topic: 'קוטר, רדיוס ושטח עיגול',
    intro: 'ערב טוב! נועה הזמינה פיצה. שימו לב: הסרגל על הבצק מודד רדיוס, אבל ההזמנה כתובה בקוטר. מתחו את הבצק, מרחו רוטב שמכסה בדיוק את כל השטח, ושלחו לתנור.',
    hints: true,
    stock: S(2600, 2200),
    tickets: [
      { id: 'L1-a', customer: 'noa', order: { dough: { kind: 'byDiameter', d: 20 }, sauce: true, crust: false }, text: 'פיצה בקוטר {{20}} ס״מ, עם רוטב עד הקצה' },
    ],
  },
  {
    id: 'L2-stuffed-crust',
    title: 'קרום ממולא',
    topic: 'היקף מעגל',
    intro: 'סבא מוטי מת על קרום ממולא גבינה. חבל הגבינה צריך להקיף את השוליים בדיוק: קצר מדי — ויישאר חור, ארוך מדי — וייצא גוש.',
    hints: true,
    stock: S(2600, 2200, 320),
    tickets: [
      { id: 'L2-a', customer: 'saba', order: { dough: { kind: 'byRadius', r: 15 }, sauce: true, crust: true }, text: 'פיצה ברדיוס {{15}} ס״מ עם קרום ממולא גבינה' },
    ],
  },
  {
    id: 'L3-hungry-kids',
    title: 'שלושה ילדים רעבים',
    topic: 'שטח עיגול — הרדיוס הקטן ביותר',
    intro: 'שלושה ילדים רעבים, וכל אחד מהם רוצה לפחות 200 סמ״ר פיצה. הבצק יקר, אז הכינו את הפיצה הקטנה ביותר שעדיין תספיק לכולם.',
    hints: true,
    stock: S(2700, 2200),
    tickets: [
      { id: 'L3-a', customer: 'kids', order: { dough: { kind: 'minArea', minArea: 600, people: 3, perPerson: 200 }, sauce: true, crust: false }, text: 'פיצה אחת לשלושה ילדים: לכל אחד לפחות {{200}} סמ״ר. הכי קטנה שאפשר!' },
    ],
  },
  {
    id: 'L4-thirty-percent',
    title: 'אותה פיצה, רחבה ב־30%',
    topic: 'אחוז שינוי ויחס שטחים',
    intro: 'נועה תמיד מזמינה פיצה בקוטר 20 עם 314 סמ״ר רוטב. היום היא רעבה במיוחד: אותה פיצה, אבל עם קוטר גדול ב־30%. כמה רוטב צריך עכשיו?',
    hints: true,
    stock: S(2600, 2400),
    ghost: { r: 10, sauce: 314 },
    tickets: [
      { id: 'L4-a', customer: 'noa', order: { dough: { kind: 'percentLarger', baseD: 20, percent: 30 }, sauce: true, crust: false }, text: 'כמו תמיד: קוטר {{20}}, רוטב {{314}} סמ״ר. רק שהיום — קוטר גדול ב־{{30%}}' },
    ],
  },
  {
    id: 'L5-family-deal',
    title: 'עסקה משפחתית',
    topic: 'השוואת שטחים — מה משתלם יותר',
    intro: 'סבא מוטי מזמין לכל המשפחה ורוצה כמה שיותר פיצה. אפשר פיצה אחת גדולה או שתיים בינוניות. שתיים נשמע יותר… אבל האם זה באמת כך?',
    hints: true,
    stock: S(4200, 4200),
    tickets: [
      { id: 'L5-a', customer: 'saba', order: { dough: { kind: 'bestDeal', options: [{ count: 1, d: 40 }, { count: 2, d: 28 }] }, sauce: true, crust: false }, text: 'כמה שיותר פיצה! אחת בקוטר {{40}} או שתיים בקוטר {{28}}? תבחרו אתם. עם רוטב' },
    ],
  },
  {
    id: 'L6-big-batch',
    title: 'בצק לכל הערב',
    topic: 'יחס ופרופורציה',
    intro: 'המתכון הסודי של פפה: קמח ומים ביחס 5 : 3. בקערה כבר יש 900 גרם קמח. מזגו מים, לושו, ותראו אם הבצק מחזיק כשמותחים אותו.',
    hints: true,
    stock: S(2600, 1800, 0, 700, 1500),
    tickets: [
      { id: 'L6-a', customer: 'noa', order: { dough: { kind: 'byDiameter', d: 24 }, sauce: true, crust: false, mix: { flour: 900, ratioFlour: 5, ratioWater: 3 } }, text: 'פיצה בקוטר {{24}} עם רוטב, מבצק טרי: {{900}} גרם קמח, קמח : מים = {{5 : 3}}' },
    ],
  },
  {
    id: 'L7-rush-hour',
    title: 'שעת עומס',
    topic: 'מבחן מסכם — בלי רמזים',
    intro: 'שישי בערב והמקום מפוצץ! ארבע הזמנות, שעון מתקתק, ובלי המחברת של השף. אתם כבר יודעים הכול.',
    hints: false,
    shiftSeconds: 150,
    stock: S(5200, 4200, 200),
    tickets: [
      { id: 'L7-a', customer: 'saba', order: { dough: { kind: 'byDiameter', d: 30 }, sauce: true, crust: false }, text: 'קוטר {{30}} ס״מ, עם רוטב' },
      { id: 'L7-b', customer: 'noa', order: { dough: { kind: 'byRadius', r: 12 }, sauce: true, crust: true }, text: 'רדיוס {{12}} ס״מ, רוטב וקרום ממולא' },
      { id: 'L7-c', customer: 'kids', order: { dough: { kind: 'minArea', minArea: 1000 }, sauce: true, crust: false }, text: 'לפחות {{1000}} סמ״ר פיצה, הכי קטנה שאפשר, עם רוטב' },
      { id: 'L7-d', customer: 'noa', order: { dough: { kind: 'percentLarger', baseD: 25, percent: 20 }, sauce: true, crust: false }, text: 'הרגילה שלי היא בקוטר {{25}}. היום — קוטר גדול ב־{{20%}}, עם רוטב' },
    ],
  },
];
