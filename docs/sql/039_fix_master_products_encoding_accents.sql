-- ==============================================================================
-- 039_fix_master_products_encoding_accents.sql
-- Corrección de caracteres especiales, eñes (ñ/Ñ) y tildes en el Catálogo Maestro Global
-- Repara mojibake heredado de decodificación CP850/UTF-8
-- ==============================================================================

begin;

update public.master_products
  set name = 'Aceto Balsámico Cocinero 250 ml Aceto Balsámico Cocinero 250 ml',
      brand = 'Cocinero',
      updated_at = now()
  where barcode = '7790070228031';
update public.master_products
  set name = 'Aguila Baño de Repostería con Leche sin Tacc 150 g',
      brand = 'Aguila',
      updated_at = now()
  where barcode = '7790580131470';
update public.master_products
  set name = 'Aguila Baño de Repostería Semiamargo sin Tacc 150 g',
      brand = 'Aguila',
      updated_at = now()
  where barcode = '7790580131487';
update public.master_products
  set name = 'Aguila Minitorta Clásica Alfajor 3 69 g',
      brand = 'Aguila',
      updated_at = now()
  where barcode = '7790040133587';
update public.master_products
  set name = 'Ají Molido Reina Mora 25 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7794268000447';
update public.master_products
  set name = 'Alicante Anís en Grano 25 g',
      brand = 'Alicante',
      updated_at = now()
  where barcode = '7790150420331';
update public.master_products
  set name = 'Alicante Orégano 25 g',
      brand = 'Alicante',
      updated_at = now()
  where barcode = '7790150540183';
update public.master_products
  set name = 'Alicante Pimentón Dulce 25 g',
      brand = 'Alicante',
      updated_at = now()
  where barcode = '7790150564844';
update public.master_products
  set name = 'Ameican Club Piña Colada',
      brand = NULL,
      updated_at = now()
  where barcode = '7790260006029';
update public.master_products
  set name = 'Arcor Presto Pronta Polenta Instantánea 490 g',
      brand = 'Arcor',
      updated_at = now()
  where barcode = '7790580138738';
update public.master_products
  set name = 'Asapractic Asapractric Cepillo para Baño',
      brand = 'Asapractic',
      updated_at = now()
  where barcode = '7792459501049';
update public.master_products
  set name = 'Cumaná Avena Instantánea sin Gluten 400 g',
      brand = 'Cumaná',
      updated_at = now()
  where barcode = '7791885414015';
update public.master_products
  set name = 'Cumaná Avena Tradicional sin Gluten 400 g',
      brand = 'Cumaná',
      updated_at = now()
  where barcode = '7791885414022';
update public.master_products
  set name = 'Bull Dog Sandía Billiken 30 g',
      brand = 'Billiken',
      updated_at = now()
  where barcode = '7798162584294';
update public.master_products
  set name = 'Petaca Cafe al Coñac',
      brand = 'Petaca',
      updated_at = now()
  where barcode = '77908377';
update public.master_products
  set name = 'Cereal Mix Arcor Choco Pasión 26 g',
      brand = 'Cereal Mix',
      updated_at = now()
  where barcode = '77984395';
update public.master_products
  set name = 'Champiñones Enteros Emeth',
      brand = 'Emeth',
      updated_at = now()
  where barcode = '7791113001628';
update public.master_products
  set name = 'Colgate Cepillo Dental Niño',
      brand = 'Colgate',
      updated_at = now()
  where barcode = '7793100151224';
update public.master_products
  set name = 'Cumaná Caballa al Natural 380 g',
      brand = 'Cumaná',
      updated_at = now()
  where barcode = '7791885005459';
update public.master_products
  set name = 'Cumaná Jardinera 300 g',
      brand = 'Cumaná',
      updated_at = now()
  where barcode = '7791885411922';
update public.master_products
  set name = 'Cusenier Cafe al Coñac',
      brand = NULL,
      updated_at = now()
  where barcode = '7792410008365';
update public.master_products
  set name = 'D.r.f Pastillas Sabor Anís 23 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7792222002841';
update public.master_products
  set name = 'D.r.f Pastillas Sabor Limón 23 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7792222002803';
update public.master_products
  set name = 'Dánica Danica Kétchup 220 g',
      brand = 'Dánica',
      updated_at = now()
  where barcode = '7791620187693';
update public.master_products
  set name = 'Doña Paula Bold Red Blend',
      brand = NULL,
      updated_at = now()
  where barcode = '7798090162212';
update public.master_products
  set name = 'Doña Pupa Garbanzos Caja 340 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7798096031079';
update public.master_products
  set name = 'Dove Nutrición 300 ml',
      brand = 'Dove',
      updated_at = now()
  where barcode = '7791293048642';
update public.master_products
  set name = 'Dove Reconstrucción Aminoácidos Acondicionador 400 ml',
      brand = 'Dove',
      updated_at = now()
  where barcode = '7791293047508';
update public.master_products
  set name = 'Elite Pañuelos Descartable',
      brand = 'Elite',
      updated_at = now()
  where barcode = '7790250000358';
update public.master_products
  set name = 'Esencial Océano Aromatizante de Ambiente en Aerosol 165 g',
      brand = 'Esencial',
      updated_at = now()
  where barcode = '7797470198575';
update public.master_products
  set name = 'Dea Esponja Pa Baño',
      brand = 'Dea',
      updated_at = now()
  where barcode = '7798059384587';
update public.master_products
  set name = 'Fideos Moños Molto al Huevo 500 g',
      brand = 'Molto',
      updated_at = now()
  where barcode = '7798138554658';
update public.master_products
  set name = 'Firenze Tostadas Clásicas 180 G',
      brand = 'Firenze',
      updated_at = now()
  where barcode = '7791568000498';
update public.master_products
  set name = 'Hogareña Galletas de Salvado 3 u',
      brand = 'Hogareña',
      updated_at = now()
  where barcode = '7790040132955';
update public.master_products
  set name = 'Lia Hamlet Alfajor Chocomaní 34,5 g',
      brand = 'Lia',
      updated_at = now()
  where barcode = '7790040144149';
update public.master_products
  set name = 'Harpic Baño 500 ml',
      brand = 'Harpic',
      updated_at = now()
  where barcode = '7791130681438';
update public.master_products
  set name = 'Harpic Baños Sache 420 ml',
      brand = 'Harpic',
      updated_at = now()
  where barcode = '7791130963299';
update public.master_products
  set name = 'Hileret Light Azúcar 250 g',
      brand = 'Hileret',
      updated_at = now()
  where barcode = '7794940000550';
update public.master_products
  set name = 'Arcor Hogareñas Salvado 200 g',
      brand = 'Arcor',
      updated_at = now()
  where barcode = '7790040132962';
update public.master_products
  set name = 'Julieta Paño para Piso',
      brand = 'Julieta',
      updated_at = now()
  where barcode = '7795085000016';
update public.master_products
  set name = 'La Campagnola Ají Triturado 23 g',
      brand = 'La Campagnola',
      updated_at = now()
  where barcode = '7790580136062';
update public.master_products
  set name = 'La Española Porotos Negros 500 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7798066030798';
update public.master_products
  set name = 'La Virginia Cafe Instantáneo 170 g',
      brand = 'La Virginia',
      updated_at = now()
  where barcode = '7790150100486';
update public.master_products
  set name = 'La Virginia Cafe Instantáneo Clásico 100 g',
      brand = 'La Virginia',
      updated_at = now()
  where barcode = '7790150100783';
update public.master_products
  set name = 'Lays Clásicas 134 g',
      brand = 'Lays',
      updated_at = now()
  where barcode = '7790310985465';
update public.master_products
  set name = 'Lays Clásicas 85 g',
      brand = 'Lays',
      updated_at = now()
  where barcode = '7790310985458';
update public.master_products
  set name = 'Lays Jamón Serrano',
      brand = 'Lays',
      updated_at = now()
  where barcode = '7790310985250';
update public.master_products
  set name = 'Lays Jamón Serrano 77 g',
      brand = 'Lays',
      updated_at = now()
  where barcode = '7790310985434';
update public.master_products
  set name = 'Lays Rústicas Limón y Hierbas',
      brand = 'Lays',
      updated_at = now()
  where barcode = '7790310988503';
update public.master_products
  set name = 'Lays Rústicas con Sal Marina',
      brand = 'Lays',
      updated_at = now()
  where barcode = '7790310988480';
update public.master_products
  set name = 'Leiva Tostadas de Arroz Sésamo,lino y Chia 160 g',
      brand = 'Leiva',
      updated_at = now()
  where barcode = '7790412001629';
update public.master_products
  set name = 'Cabrales Liv Clásico Edulcorante Caja 50 u',
      brand = 'Cabrales',
      updated_at = now()
  where barcode = '7790550005619';
update public.master_products
  set name = 'Make Esponja Cocina Salvauña',
      brand = 'Make',
      updated_at = now()
  where barcode = '7798092961035';
update public.master_products
  set name = 'Mani King Garrapiñada 80 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7798151950260';
update public.master_products
  set name = 'Mantecol Clásico sin Tacc 111 g',
      brand = 'Mantecol',
      updated_at = now()
  where barcode = '7622201812652';
update public.master_products
  set name = 'Mantecol Clásico sin Tacc 41 g',
      brand = 'Mantecol',
      updated_at = now()
  where barcode = '7622201816414';
update public.master_products
  set name = 'Mantecol Clásico sin Tacc 64 g',
      brand = 'Mantecol',
      updated_at = now()
  where barcode = '7622201816445';
update public.master_products
  set name = 'Marolio Maíz Pisado Blanco 400 g',
      brand = 'Marolio',
      updated_at = now()
  where barcode = '7797470128121';
update public.master_products
  set name = 'Marolio Maíz Pisingallo 400 g',
      brand = 'Marolio',
      updated_at = now()
  where barcode = '7797470128114';
update public.master_products
  set name = 'Matarazzo Libre de Gluten Mix de Legumbres Tirabuzón 500 g',
      brand = 'Matarazzo',
      updated_at = now()
  where barcode = '7790070336224';
update public.master_products
  set name = 'Naipes Español',
      brand = 'Naipes',
      updated_at = now()
  where barcode = '7453038473064';
update public.master_products
  set name = 'Molto Atún 170 G',
      brand = 'Molto',
      updated_at = now()
  where barcode = '7798738552692';
update public.master_products
  set name = 'Molto Atún 170 G',
      brand = 'Molto',
      updated_at = now()
  where barcode = '7798138552708';
update public.master_products
  set name = 'Molto Moños Espinaca 500 g',
      brand = 'Molto',
      updated_at = now()
  where barcode = '7798138554665';
update public.master_products
  set name = 'Mr Musculo Baño',
      brand = NULL,
      updated_at = now()
  where barcode = '7790520999320';
update public.master_products
  set name = 'Naipes Española Escolaso',
      brand = 'Naipes',
      updated_at = now()
  where barcode = '7797216003040';
update public.master_products
  set name = 'Nescafé Dolca 50 G',
      brand = 'Dolca',
      updated_at = now()
  where barcode = '8445291082175';
update public.master_products
  set name = 'Ñoquis 500 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7795293104100';
update public.master_products
  set name = 'Panadería Pan',
      brand = 'Panadería',
      updated_at = now()
  where barcode = 'PANCOMUN';
update public.master_products
  set name = 'Paño Pofesional para Detailing Microfibra Walker',
      brand = 'Walker',
      updated_at = now()
  where barcode = '7798053624436';
update public.master_products
  set name = 'Pantene Nutrición 270 ml',
      brand = 'Pantene',
      updated_at = now()
  where barcode = '7500435243667';
update public.master_products
  set name = 'Papel Higiénico Higienol Max 4 Rayos',
      brand = 'Higienol',
      updated_at = now()
  where barcode = '7790250015864';
update public.master_products
  set name = 'Cumaná Pimientos Morrones Enteros Cumaná 185 G',
      brand = 'Cumaná',
      updated_at = now()
  where barcode = '7791885413735';
update public.master_products
  set name = 'Piña Colada Petaca',
      brand = 'Petaca',
      updated_at = now()
  where barcode = '77991829';
update public.master_products
  set name = 'Pink21 Mascara de Pestaña Up!',
      brand = 'Pink21',
      updated_at = now()
  where barcode = '6952938412940';
update public.master_products
  set name = 'Pink21 Mascara Pestaña So Thin',
      brand = 'Pink21',
      updated_at = now()
  where barcode = '6952938487313';
update public.master_products
  set name = 'Pipas Clásicas 18 g',
      brand = 'Pipas',
      updated_at = now()
  where barcode = '77965233';
update public.master_products
  set name = 'Pipón Semillas de Girasol Nikitos 20 g',
      brand = 'Nikitos',
      updated_at = now()
  where barcode = '7798052361349';
update public.master_products
  set name = 'Plusbelle Acondicionador Nutrición óleo de Argán y Macadamia',
      brand = 'Plusbelle',
      updated_at = now()
  where barcode = '7790740000349';
update public.master_products
  set name = 'Porteñitas Bagley 139 g',
      brand = 'Bagley',
      updated_at = now()
  where barcode = '7790040132689';
update public.master_products
  set name = 'Arcor Presto Pronta Sabor.panceta y Queso Instantánea 250 g',
      brand = 'Arcor',
      updated_at = now()
  where barcode = '7790580126322';
update public.master_products
  set name = 'Q.soft Toallas Húmedas Premium con Ph Balanceado 40 u',
      brand = 'Q.soft',
      updated_at = now()
  where barcode = '7790773083654';
update public.master_products
  set name = 'Quaker Avena Integral Instantánea 280 g',
      brand = 'Quaker',
      updated_at = now()
  where barcode = '7792170555505';
update public.master_products
  set name = 'Ravioles Di Pascuales Jamón y Mozzarella 400 G',
      brand = NULL,
      updated_at = now()
  where barcode = '7798118140581';
update public.master_products
  set name = 'Marvese Rebosador de Arroz Clásico 400 g',
      brand = 'Marvese',
      updated_at = now()
  where barcode = '7798306830201';
update public.master_products
  set name = 'Reina Mora Orégano 25 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7794268000195';
update public.master_products
  set name = 'Reina Mora Pimentón 25 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7794268000423';
update public.master_products
  set name = 'Rollo Cocina Ultra Marolio 200 Paño',
      brand = 'Marolio',
      updated_at = now()
  where barcode = '7797470199114';
update public.master_products
  set name = 'Suiza Rollo Cosina x 200 Paños',
      brand = 'Suiza',
      updated_at = now()
  where barcode = '720665993263';
update public.master_products
  set name = 'Saladix Sabor Jamón 40 g',
      brand = 'Saladix',
      updated_at = now()
  where barcode = '7790040152014';
update public.master_products
  set name = 'Schweppes Agua Tónica',
      brand = 'Schweppes',
      updated_at = now()
  where barcode = '7790895006715';
update public.master_products
  set name = 'Sed Mental Paño Anti-bacterias',
      brand = NULL,
      updated_at = now()
  where barcode = '7790560003803';
update public.master_products
  set name = 'Shampoo Dove Regeneración Retinol 400 ml',
      brand = 'Dove',
      updated_at = now()
  where barcode = '7791293047171';
update public.master_products
  set name = 'Swift Lomitos de Atún en Aceite de Girasol 170 g',
      brand = 'Swift',
      updated_at = now()
  where barcode = '7790360984241';
update public.master_products
  set name = 'Swift Paté de Foie 90 g',
      brand = 'Swift',
      updated_at = now()
  where barcode = '7790360720382';
update public.master_products
  set name = 'Swift Paté de Foie Picante de Jalapeño 90 g',
      brand = 'Swift',
      updated_at = now()
  where barcode = '7790360984715';
update public.master_products
  set name = 'Taragüí Te 25 u',
      brand = 'Taragüí',
      updated_at = now()
  where barcode = '7790387800135';
update public.master_products
  set name = 'Taragüí Te de Tilo 20 u',
      brand = 'Taragüí',
      updated_at = now()
  where barcode = '7790387001433';
update public.master_products
  set name = 'Tatín 3 Blanco Arcor 60 g',
      brand = 'Arcor',
      updated_at = now()
  where barcode = '7790040405301';
update public.master_products
  set name = 'Tatín 3 Negro Arcor 60 g',
      brand = 'Arcor',
      updated_at = now()
  where barcode = '7790040405608';
update public.master_products
  set name = 'Té de Boldo Cachamay',
      brand = 'Cachamay',
      updated_at = now()
  where barcode = '7792280000353';
update public.master_products
  set name = 'Textil Duramas Paño Franela',
      brand = NULL,
      updated_at = now()
  where barcode = '7798349550111';
update public.master_products
  set name = 'Tia Maruca Fajitas Clásicas 120 g',
      brand = NULL,
      updated_at = now()
  where barcode = '7798082745430';
update public.master_products
  set name = 'Toallitas Nosotras Protección y Confianza 8 u',
      brand = 'Nosotras',
      updated_at = now()
  where barcode = '7790770601882';
update public.master_products
  set name = 'Tomates Cubeteados con Cebolla y Orégano la Campagnola',
      brand = 'La Campagnola',
      updated_at = now()
  where barcode = '7790580141530';
update public.master_products
  set name = 'Traviatas Porteñitas Azucaradas 96 g',
      brand = 'Traviata',
      updated_at = now()
  where barcode = '7790040152793';
update public.master_products
  set name = 'Trio Choc Pepas Bañadas 500 g',
      brand = 'Trio',
      updated_at = now()
  where barcode = '7791787100382';
update public.master_products
  set name = 'Turrón y Maní Arcor 25 g',
      brand = 'Arcor',
      updated_at = now()
  where barcode = '77940131';
update public.master_products
  set name = 'Uytuna Trozos de Atún al Natural',
      brand = 'Uytuna',
      updated_at = now()
  where barcode = '7730977690098';
update public.master_products
  set name = 'Viñas de Balbo',
      brand = NULL,
      updated_at = now()
  where barcode = '7791843008294';
update public.master_products
  set name = 'Viñas de Balbo Blanco',
      brand = NULL,
      updated_at = now()
  where barcode = '7791843008317';
update public.master_products
  set name = 'Mañanita Yerba Mañanita 500 g',
      brand = 'Mañanita',
      updated_at = now()
  where barcode = '7790387015324';
update public.master_products
  set name = 'Zorro Limpiador Liquido Baño 500 ml',
      brand = 'Zorro',
      updated_at = now()
  where barcode = '7790990000663';

commit;
