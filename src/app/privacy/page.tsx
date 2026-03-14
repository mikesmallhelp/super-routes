import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tietosuojaseloste – Tehoreitit",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Tietosuojaseloste</h1>

      <div className="space-y-6 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Kerättävät tiedot
          </h2>
          <p>
            Sovellus kerää kirjautumisen yhteydessä Google-tililtäsi seuraavat
            tiedot: nimi, sähköpostiosoite ja profiilikuva. Lisäksi tallennetaan
            käyttäjän luomat matkat (lähtöpaikka, määränpää ja valitut
            liikennevälineet).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Tietojen käyttötarkoitus
          </h2>
          <p>
            Tietoja käytetään ainoastaan sovelluksen toiminnan mahdollistamiseen:
            käyttäjän tunnistamiseen ja tallennettujen matkojen näyttämiseen.
            Tietoja ei luovuteta kolmansille osapuolille eikä käytetä
            markkinointiin.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Sijaintitiedot
          </h2>
          <p>
            Sovellus voi pyytää selaimen sijaintitietoa matkojen järjestämiseksi
            etäisyyden mukaan. Sijaintitietoa ei tallenneta palvelimelle.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Evästeet
          </h2>
          <p>
            Sovellus käyttää ainoastaan kirjautumiseen tarvittavia
            istuntoevästeitä. Analytiikka- tai mainosevästeitä ei käytetä.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Tietojen poistaminen
          </h2>
          <p>
            Voit poistaa tallennetut matkasi sovelluksen kautta. Jos haluat
            poistaa kaikki tietosi kokonaan, ota yhteyttä ylläpitäjään.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Tietojen säilytys
          </h2>
          <p>
            Tiedot säilytetään PostgreSQL-tietokannassa, joka voi sijaita
            EU:n ulkopuolella. Palveluntarjoajat (Vercel, Google) voivat
            käsitellä tietoja myös Yhdysvalloissa. Siirrot perustuvat
            EU–US Data Privacy Frameworkiin. Tietoja käsitellään EU:n
            tietosuoja-asetuksen (GDPR) mukaisesti.
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Takaisin
        </Link>
      </div>
    </div>
  );
}
