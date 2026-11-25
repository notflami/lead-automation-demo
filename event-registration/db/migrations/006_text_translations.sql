-- Translations of the texts organizers edit in "Event settings".
-- German (the normal columns) is the base; translations[lang][field] override it per language.
-- An empty or missing translation falls back to the German text.
alter table event_settings add column if not exists translations jsonb not null default '{}'::jsonb;

-- Pre-fill translations of the current event texts. Only when no translations exist yet, and only for
-- fields whose German text still matches the text that was translated (ignoring spaces and case).
do $$
declare
  r record;
  current_text text;
begin
  if (select translations from event_settings where id = 1) <> '{}'::jsonb then
    return;
  end if;
  for r in
    select * from (values
    (E'tagline', E'en', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Music, drinks and Balkan culture – an evening for everyone.'),
    (E'about_text', E'en', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'A cultural evening with music from the Balkans, a well-stocked bar and guests from many countries.\n\nWhether you grew up with these songs or are hearing them for the first time: come along, celebrate with us and meet new people.'),
    (E'expectations', E'en', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Live music and a DJ until late at night\nBar with drinks and specialities from the Balkans\nCultural programme and kolo dancing to join in\nGuests from many countries and generations'),
    (E'dress_code', E'en', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Smart casual. Traditional dress is welcome.'),
    (E'additional_info', E'en', E'Bitte bringt eure Reservierungsnummer mit.', E'Please bring your reservation number.'),
    (E'ticket_normal_info', E'en', E'Stehplatz, Selbstbedienung', E'Standing place, self-service'),
    (E'ticket_vip_info', E'en', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Incl. parking space, seat and table service'),
    (E'tagline', E'sq', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Muzikë, pije dhe kulturë ballkanike – një mbrëmje për të gjithë.'),
    (E'about_text', E'sq', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Një mbrëmje kulturore me muzikë nga Ballkani, një bar të pasur dhe mysafirë nga shumë vende.\n\nNëse jeni rritur me këto këngë apo i dëgjoni për herë të parë: ejani, festoni me ne dhe njihuni me njerëz të rinj.'),
    (E'expectations', E'sq', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Muzikë live dhe DJ deri natën vonë\nBar me pije dhe specialitete nga Ballkani\nProgram kulturor dhe valle kolo për të gjithë\nMysafirë nga shumë vende dhe breza'),
    (E'dress_code', E'sq', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegant dhe i rehatshëm. Veshja tradicionale është e mirëpritur.'),
    (E'additional_info', E'sq', E'Bitte bringt eure Reservierungsnummer mit.', E'Ju lutemi sillni numrin e rezervimit.'),
    (E'ticket_normal_info', E'sq', E'Stehplatz, Selbstbedienung', E'Vend në këmbë, vetëshërbim'),
    (E'ticket_vip_info', E'sq', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Përfshin parkim, vend për t\'u ulur dhe shërbim në tavolinë'),
    (E'tagline', E'bs', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Muzika, piće i balkanska kultura – večer za sve.'),
    (E'about_text', E'bs', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Kulturna večer uz muziku s Balkana, dobro opremljen bar i goste iz mnogih zemalja.\n\nBez obzira jeste li odrasli uz ove pjesme ili ih slušate prvi put: dođite, slavite s nama i upoznajte nove ljude.'),
    (E'expectations', E'bs', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Muzika uživo i DJ do kasno u noć\nBar s pićem i specijalitetima s Balkana\nKulturni program i kolo za sve\nGosti iz mnogih zemalja i generacija'),
    (E'dress_code', E'bs', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegantno-ležerno. Tradicionalna odjeća je dobrodošla.'),
    (E'additional_info', E'bs', E'Bitte bringt eure Reservierungsnummer mit.', E'Molimo ponesite svoj broj rezervacije.'),
    (E'ticket_normal_info', E'bs', E'Stehplatz, Selbstbedienung', E'Mjesto za stajanje, samoposluživanje'),
    (E'ticket_vip_info', E'bs', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Uključuje parking, mjesto za sjedenje i posluživanje za stolom'),
    (E'tagline', E'hr', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Glazba, piće i balkanska kultura – večer za sve.'),
    (E'about_text', E'hr', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Kulturna večer uz glazbu s Balkana, dobro opskrbljen bar i goste iz mnogih zemalja.\n\nBez obzira jeste li odrasli uz ove pjesme ili ih slušate prvi put: dođite, slavite s nama i upoznajte nove ljude.'),
    (E'expectations', E'hr', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Glazba uživo i DJ do kasno u noć\nBar s pićem i specijalitetima s Balkana\nKulturni program i kolo za sve\nGosti iz mnogih zemalja i generacija'),
    (E'dress_code', E'hr', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegantno-ležerno. Tradicionalna odjeća je dobrodošla.'),
    (E'additional_info', E'hr', E'Bitte bringt eure Reservierungsnummer mit.', E'Molimo ponesite svoj broj rezervacije.'),
    (E'ticket_normal_info', E'hr', E'Stehplatz, Selbstbedienung', E'Mjesto za stajanje, samoposluživanje'),
    (E'ticket_vip_info', E'hr', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Uključuje parkirno mjesto, mjesto za sjedenje i posluživanje za stolom'),
    (E'tagline', E'sr', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Muzika, piće i balkanska kultura – veče za sve.'),
    (E'about_text', E'sr', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Kulturno veče uz muziku sa Balkana, dobro snabdeven bar i goste iz mnogih zemalja.\n\nBez obzira na to da li ste odrasli uz ove pesme ili ih slušate prvi put: dođite, slavite sa nama i upoznajte nove ljude.'),
    (E'expectations', E'sr', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Muzika uživo i DJ do kasno u noć\nBar sa pićem i specijalitetima sa Balkana\nKulturni program i kolo za sve\nGosti iz mnogih zemalja i generacija'),
    (E'dress_code', E'sr', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegantno-ležerno. Tradicionalna odeća je dobrodošla.'),
    (E'additional_info', E'sr', E'Bitte bringt eure Reservierungsnummer mit.', E'Molimo ponesite svoj broj rezervacije.'),
    (E'ticket_normal_info', E'sr', E'Stehplatz, Selbstbedienung', E'Mesto za stajanje, samoposluživanje'),
    (E'ticket_vip_info', E'sr', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Uključuje parking, mesto za sedenje i posluživanje za stolom'),
    (E'tagline', E'tr', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Müzik, içecekler ve Balkan kültürü – herkes için bir gece.'),
    (E'about_text', E'tr', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Balkan müziği, zengin bir bar ve birçok ülkeden misafirlerle kültürel bir gece.\n\nBu şarkılarla büyüdünüz ya da onları ilk kez duyuyorsunuz: gelin, bizimle kutlayın ve yeni insanlarla tanışın.'),
    (E'expectations', E'tr', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Gece geç saatlere kadar canlı müzik ve DJ\nİçecekler ve Balkan lezzetleriyle bar\nKültür programı ve herkesin katılabileceği kolo dansı\nBirçok ülkeden ve kuşaktan misafirler'),
    (E'dress_code', E'tr', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Şık ve rahat. Geleneksel kıyafetler memnuniyetle karşılanır.'),
    (E'additional_info', E'tr', E'Bitte bringt eure Reservierungsnummer mit.', E'Lütfen rezervasyon numaranızı yanınızda getirin.'),
    (E'ticket_normal_info', E'tr', E'Stehplatz, Selbstbedienung', E'Ayakta yer, self servis'),
    (E'ticket_vip_info', E'tr', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Otopark, oturma yeri ve masaya servis dahil')
    ) as t(field, lang, source_de, translated)
  loop
    execute format('select %I from event_settings where id = 1', r.field) into current_text;
    if lower(regexp_replace(coalesce(current_text, ''), '\s+', '', 'g')) = lower(regexp_replace(r.source_de, '\s+', '', 'g')) then
      update event_settings
         set translations = jsonb_set(translations, array[r.lang],
                                      coalesce(translations -> r.lang, '{}'::jsonb) || jsonb_build_object(r.field, r.translated))
       where id = 1;
    end if;
  end loop;
end $$;
