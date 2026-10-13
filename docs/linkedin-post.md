# LinkedIn project introduction

## German

Ich habe mein Trading-Journal aus Notion zu einem privaten Analytics-Dashboard erweitert.

Die Anwendung synchronisiert die Journal-Daten mit PostgreSQL und macht daraus Auswertungen zu Performance, Drawdown, Setups, Handelszeiten und einzelnen Trades. Zusätzlich gibt es eine iPhone-App, die das Dashboard in einer nativen SwiftUI-Hülle bereitstellt.

Technisch verbindet das Projekt Next.js, TypeScript, PostgreSQL, einen separaten Synchronisierungs-Worker und SwiftUI. Beim Entwurf waren mir eine klare Trennung zwischen privaten Zugangsdaten und Anwendungscode sowie ein nachvollziehbarer Datenfluss wichtig.

Das Projekt ist auf mein eigenes Journal zugeschnitten und führt keine Trades aus. Der Quellcode und die lokale Demo sind im Repository verfügbar.

#NextJS #TypeScript #SwiftUI #PostgreSQL #DataAnalytics #PersonalProject

## English

I built a private analytics dashboard around my Notion trading journal.

It syncs journal data into PostgreSQL and turns it into views of performance, drawdown, setups, trading sessions and individual trades. I also built an iPhone app that presents the dashboard in a native SwiftUI shell.

The project brings together Next.js, TypeScript, PostgreSQL, a separate sync worker and SwiftUI. I focused on keeping credentials out of application code and making the data flow easy to understand.

It is tailored to my journal and does not execute trades. The source code and local demo are available in the repository.

#NextJS #TypeScript #SwiftUI #PostgreSQL #DataAnalytics #SideProject
