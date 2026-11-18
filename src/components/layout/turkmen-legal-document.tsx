import { COMPANY, CONSENT_VERSION } from "@/lib/config/constants";

const DOCUMENTS = {
  terms: {
    title: "Hyzmat şertleri",
    sections: [
      [
        "1. Umumy düzgünler",
        "Ýazmaça terjime, notarial tassyklama, çap we ätiýaçlandyryş hyzmatlary hödürlenýär. Sargyt beren müşderi şu şertlere razy bolýar.",
      ],
      [
        "2. Ýerine ýetiriş möhleti",
        "Aýratyn hyzmatda başgaça görkezilmedik bolsa, adaty möhlet 1–2 iş günüdür. Gyssagly ýerine ýetiriş üçin (1 gün) 1,5 we şol gün ýerine ýetiriş üçin 2 köpeldiji ulanylýar.",
      ],
      [
        "3. Töleg",
        "Töleg kabul ediş nokadynda nagt ýa-da kart bilen, onlaýn bolsa degişli üpjün ediji birikdirilende geçirilýär. Iş tölegden soň başlanýar. Bellenen möçberden ýokary sargytlarda we notarial terjimelerde öňünden töleg, galan bölegi üçin bolsa resminamalar alnanda töleg göz öňünde tutulýar. Goşmaça işler müşderi bilen ylalaşylandan soň aýratyn tölenýär. Täze sargytlaryň bahasy manat (TMT) bilen görkezilýär.",
      ],
      [
        "4. Ýatyrmak we puly gaýtarmak",
        "Iş başlanmanka sargyt ýatyrylsa, tölenen pul doly gaýtarylýar. Iş başlanan bolsa, ýerine ýetirilen bölegiň bahasy aýrylýar. Pul tölenen usul bilen, adatça 1–5 iş gününiň dowamynda gaýtarylýar.",
      ],
      [
        "5. Jogapkärçilik",
        "Ýerine ýetiriji terjimäniň hili üçin sargydyň bahasynyň çäginde jogapkärçilik çekýär. Notarial tassyklama notariat baradaky kanunçylyga laýyklykda ýerine ýetirilýär.",
      ],
    ],
  },
  privacy: {
    title: "Gizlinlik syýasaty",
    sections: [
      [
        "1. Ýygnalýan maglumatlar",
        "Doly adyňyz, telefon belgiňiz, e-poçtaňyz, Telegram maglumatlaryňyz we terjime üçin ýükleýän faýllaryňyz işlenilýär. Maglumatlar sargydy kabul etmek we ýerine ýetirmek, bahany hasaplamak we ýagdaýy habar bermek üçin zerurdyr.",
      ],
      [
        "2. Işlemegiň maksatlary",
        "Terjime, çap we ätiýaçlandyryş sargytlaryny ýerine ýetirmek; bahany we möhleti hasaplamak; Telegram, SMS ýa-da e-poçta arkaly habar bermek; şahsy otagda sargytlaryň taryhyny saklamak.",
      ],
      [
        "3. Saklamak we goramak",
        "Maglumatlara giriş işgärleriň ygtyýarlyklary bilen çäklendirilýär. Faýllar ýapyk ammarda saklanýar we möhleti çäklendirilen gol çekilen salgylanmalar arkaly berilýär. Maglumatlary ýerleşdirmek üçin Russiýanyň çägindäki serwerler göz öňünde tutulýar.",
      ],
      [
        "4. Hukuklaryňyz",
        `Maglumatlaryňyzyň nusgasyny ýa-da pozulmagyny şahsy otagdaky «Meniň maglumatlarym» bölüminden ýa-da ${COMPANY.email} arkaly sorap bilersiňiz.`,
      ],
    ],
  },
  consent: {
    title: "Şahsy maglumatlary işlemäge razylyk",
    sections: [
      [
        "Razylyk",
        "27.07.2006 seneli № 152-ФЗ kanunyna laýyklykda, öz islegim bilen şahsy maglumatlarymyň işlenilmegine razylyk berýärin.",
      ],
      [
        "Maglumatlaryň sanawy",
        "Familiýa, at, atasynyň ady; telefon belgisi; e-poçta; Telegram belgisi; terjimäni ýerine ýetirmek üçin ýüklenen faýllardaky maglumatlar.",
      ],
      [
        "Maksatlar",
        "Sargydy kabul etmek we ýerine ýetirmek, bahany hasaplamak, sargydyň ýagdaýy barada habar bermek we sargytlaryň taryhyny saklamak.",
      ],
      [
        "Hereket ediş möhleti",
        `Razylyk berlen pursadyndan maksatlara ýetilýänçä ýa-da yzyna alynýança hereket edýär. Razylygy ${COMPANY.email} arkaly ýa-da şahsy otagdan yzyna alyp bilersiňiz.`,
      ],
    ],
  },
} as const;

/** Русские тексты остаются доступны при выборе русского языка. */
export function TurkmenLegalDocument({ kind }: { kind: keyof typeof DOCUMENTS }) {
  const doc = DOCUMENTS[kind];
  return (
    <div className="container max-w-3xl py-12" lang="tk">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">{doc.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {COMPANY.legalName} · {COMPANY.address}
      </p>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        {doc.sections.map(([title, text]) => (
          <section key={title}>
            <h2 className="mb-2 text-base font-semibold text-foreground">{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      {kind === "consent" && (
        <p className="mt-6 text-xs text-muted-foreground">
          Resminamanyň wersiýasy: {CONSENT_VERSION}. Razylyk her sargytda senesi, wagty we IP
          salgysy bilen hasaba alynýar.
        </p>
      )}
    </div>
  );
}
