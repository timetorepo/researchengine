/**
 * Practice exam bank: basic civics and general-knowledge questions for 12
 * countries (the USA, Indonesia and 10 others).
 *
 * These are practice questions written for this app, based on widely published
 * civics facts. They are NOT an official citizenship or government test. Check
 * an official source before you rely on any of them.
 */

export interface ExamQuestion {
  q: string
  options: [string, string, string, string]
  /** Index into `options`. */
  answer: 0 | 1 | 2 | 3
  /** One line shown after the answer. */
  note: string
}

export interface ExamCountry {
  id: string
  name: string
  flag: string
  questions: ExamQuestion[]
}

export const EXAM_COUNTRIES: ExamCountry[] = [
  {
    id: 'us', name: 'United States', flag: '🇺🇸',
    questions: [
      { q: 'How many U.S. senators are there?', options: ['50', '100', '435', '538'], answer: 1, note: 'Each of the 50 states has two senators.' },
      { q: 'In what year was the U.S. Constitution ratified?', options: ['1776', '1787', '1788', '1791'], answer: 2, note: 'Ratified in 1788; the Bill of Rights followed in 1791.' },
      { q: 'How many amendments are in the Bill of Rights?', options: ['5', '10', '12', '27'], answer: 1, note: 'The first ten amendments.' },
    ],
  },
  {
    id: 'id', name: 'Indonesia', flag: '🇮🇩',
    questions: [
      { q: 'How many principles are in Pancasila?', options: ['3', '5', '7', '10'], answer: 1, note: 'Belief in one God, just and civilised humanity, unity, democracy through deliberation, and social justice.' },
      { q: 'What is the national language of Indonesia?', options: ['Javanese', 'Bahasa Indonesia', 'English', 'Sundanese'], answer: 1, note: 'Bahasa Indonesia, the language of the 1928 Youth Pledge.' },
      { q: 'When was Indonesia’s independence proclaimed?', options: ['17 August 1945', '28 October 1928', '1 June 1945', '20 May 1908'], answer: 0, note: 'Proclaimed on 17 August 1945.' },
    ],
  },
  {
    id: 'gb', name: 'United Kingdom', flag: '🇬🇧',
    questions: [
      { q: 'Who is the head of state of the United Kingdom?', options: ['The Prime Minister', 'The monarch', 'The Speaker', 'The President'], answer: 1, note: 'The monarch is head of state; the Prime Minister is head of government.' },
      { q: 'How many seats are in the House of Commons?', options: ['500', '600', '650', '700'], answer: 2, note: '650 seats since the 2024 general election.' },
      { q: 'What is the capital of Scotland?', options: ['Glasgow', 'Aberdeen', 'Edinburgh', 'Inverness'], answer: 2, note: 'Edinburgh is the capital; Glasgow is the largest city.' },
    ],
  },
  {
    id: 'ca', name: 'Canada', flag: '🇨🇦',
    questions: [
      { q: 'What is the capital of Canada?', options: ['Toronto', 'Montreal', 'Ottawa', 'Vancouver'], answer: 2, note: 'Ottawa is the capital city.' },
      { q: 'What are Canada’s two official languages?', options: ['English and Spanish', 'English and French', 'French and Inuktitut', 'English and German'], answer: 1, note: 'English and French, under the Official Languages Act.' },
      { q: 'How many provinces does Canada have?', options: ['3', '10', '12', '13'], answer: 1, note: 'Ten provinces and three territories.' },
    ],
  },
  {
    id: 'au', name: 'Australia', flag: '🇦🇺',
    questions: [
      { q: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], answer: 2, note: 'Canberra, chosen as a compromise between Sydney and Melbourne.' },
      { q: 'Who represents the monarch in Australia day to day?', options: ['The Prime Minister', 'The Governor-General', 'The Chief Justice', 'The Speaker'], answer: 1, note: 'The Governor-General acts for the King.' },
      { q: 'How many states does Australia have?', options: ['4', '6', '8', '10'], answer: 1, note: 'Six states, plus territories.' },
    ],
  },
  {
    id: 'de', name: 'Germany', flag: '🇩🇪',
    questions: [
      { q: 'What is the capital of Germany?', options: ['Munich', 'Hamburg', 'Berlin', 'Frankfurt'], answer: 2, note: 'Berlin has been the capital since reunification.' },
      { q: 'In what year was the Basic Law (Grundgesetz) adopted?', options: ['1919', '1933', '1949', '1990'], answer: 2, note: 'Adopted in 1949, it is the constitution of Germany.' },
      { q: 'How many states (Länder) make up Germany?', options: ['10', '13', '16', '20'], answer: 2, note: 'Sixteen Länder.' },
    ],
  },
  {
    id: 'fr', name: 'France', flag: '🇫🇷',
    questions: [
      { q: 'What is the capital of France?', options: ['Lyon', 'Marseille', 'Paris', 'Nice'], answer: 2, note: 'Paris.' },
      { q: 'What is the national motto of France?', options: ['Unity, Faith, Order', 'Liberty, Equality, Fraternity', 'Truth, Justice, Peace', 'Strength in Unity'], answer: 1, note: 'Liberté, égalité, fraternité.' },
      { q: 'What is France’s national day?', options: ['14 July', '8 May', '11 November', '21 July'], answer: 0, note: 'Bastille Day, 14 July.' },
    ],
  },
  {
    id: 'jp', name: 'Japan', flag: '🇯🇵',
    questions: [
      { q: 'What is the capital of Japan?', options: ['Kyoto', 'Osaka', 'Tokyo', 'Nagoya'], answer: 2, note: 'Tokyo.' },
      { q: 'In what year did the current Japanese constitution take effect?', options: ['1889', '1947', '1952', '1964'], answer: 1, note: 'In force from 1947; the emperor is a symbol of the state.' },
      { q: 'What is the name of Japan’s national legislature?', options: ['The Congress', 'The Diet', 'The Parliament', 'The Assembly'], answer: 1, note: 'The National Diet.' },
    ],
  },
  {
    id: 'in', name: 'India', flag: '🇮🇳',
    questions: [
      { q: 'What is the capital of India?', options: ['Mumbai', 'Kolkata', 'New Delhi', 'Chennai'], answer: 2, note: 'New Delhi.' },
      { q: 'What date is Republic Day in India?', options: ['15 August', '26 January', '2 October', '26 November'], answer: 1, note: 'The constitution came into force on 26 January 1950.' },
      { q: 'Which script is used to write Hindi?', options: ['Tamil', 'Bengali', 'Devanagari', 'Gurmukhi'], answer: 2, note: 'Devanagari.' },
    ],
  },
  {
    id: 'br', name: 'Brazil', flag: '🇧🇷',
    questions: [
      { q: 'What is the capital of Brazil?', options: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], answer: 2, note: 'Brasília, since 1960.' },
      { q: 'What is the official language of Brazil?', options: ['Spanish', 'Portuguese', 'English', 'Tupi'], answer: 1, note: 'Portuguese.' },
      { q: 'What is the currency of Brazil?', options: ['Peso', 'Sol', 'Real', 'Bolívar'], answer: 2, note: 'The real (plural reais).' },
    ],
  },
  {
    id: 'mx', name: 'Mexico', flag: '🇲🇽',
    questions: [
      { q: 'What is the capital of Mexico?', options: ['Guadalajara', 'Monterrey', 'Mexico City', 'Puebla'], answer: 2, note: 'Mexico City.' },
      { q: 'When is Mexico’s Independence Day celebrated?', options: ['5 May', '16 September', '20 November', '12 October'], answer: 1, note: 'Marking the Grito de Dolores on 16 September 1810.' },
      { q: 'How long is one presidential term in Mexico?', options: ['4 years', '5 years', '6 years', '8 years'], answer: 2, note: 'Six years, with no re-election.' },
    ],
  },
  {
    id: 'ph', name: 'Philippines', flag: '🇵🇭',
    questions: [
      { q: 'What is the capital of the Philippines?', options: ['Cebu City', 'Quezon City', 'Manila', 'Davao City'], answer: 2, note: 'Manila is the capital city.' },
      { q: 'What are the official languages of the Philippines?', options: ['Tagalog and Spanish', 'Filipino and English', 'Cebuano and English', 'Filipino and Spanish'], answer: 1, note: 'Filipino and English.' },
      { q: 'What is Philippine Independence Day?', options: ['12 June', '4 July', '17 August', '28 October'], answer: 0, note: 'Marking the 12 June 1898 declaration of independence.' },
    ],
  },
]

export function countryById(id: string): ExamCountry | undefined {
  return EXAM_COUNTRIES.find((c) => c.id === id)
}
