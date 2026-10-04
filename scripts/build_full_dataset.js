import fs from 'fs';
import path from 'path';

const allCountries = [
  // =========================================================================
  // EUROPE (44 Sovereign Countries + Microstates)
  // =========================================================================
  {
    id: "ALB", numericId: "008", iso2: "AL", name: "Albania", officialName: "Republic of Albania",
    continent: "Europe", subregion: "Southern Europe", capital: "Tirana",
    coordinates: [20.1683, 41.1533], capitalCoordinates: [19.8189, 41.3275], flagEmoji: "🇦🇱",
    facts: { politicalRegime: "Parliamentary republic", leader: "Bajram Begaj", cuisine: "Tavë Kosi", currency: "Albanian Lek (ALL)" }
  },
  {
    id: "AND", numericId: "020", iso2: "AD", name: "Andorra", officialName: "Principality of Andorra",
    continent: "Europe", subregion: "Southern Europe", capital: "Andorra la Vella",
    coordinates: [1.5218, 42.5063], capitalCoordinates: [1.5218, 42.5063], flagEmoji: "🇦🇩",
    facts: { politicalRegime: "Parliamentary co-principality", leader: "Xavier Espot Zamora", cuisine: "Escudella", currency: "Euro (EUR)" }
  },
  {
    id: "AUT", numericId: "040", iso2: "AT", name: "Austria", officialName: "Republic of Austria",
    continent: "Europe", subregion: "Central Europe", capital: "Vienna",
    coordinates: [14.5501, 47.5162], capitalCoordinates: [16.3738, 48.2082], flagEmoji: "🇦🇹",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "Karl Nehammer", cuisine: "Wiener Schnitzel", currency: "Euro (EUR)" }
  },
  {
    id: "BLR", numericId: "112", iso2: "BY", name: "Belarus", officialName: "Republic of Belarus",
    continent: "Europe", subregion: "Eastern Europe", capital: "Minsk",
    coordinates: [27.9534, 53.7098], capitalCoordinates: [27.5615, 53.9045], flagEmoji: "🇧🇾",
    facts: { politicalRegime: "Presidential republic", leader: "Aleksandr Lukashenko", cuisine: "Draniki", currency: "Belarusian Ruble (BYN)" }
  },
  {
    id: "BEL", numericId: "056", iso2: "BE", name: "Belgium", officialName: "Kingdom of Belgium",
    continent: "Europe", subregion: "Western Europe", capital: "Brussels",
    coordinates: [4.4699, 50.5039], capitalCoordinates: [4.3517, 50.8503], flagEmoji: "🇧🇪",
    facts: { politicalRegime: "Federal parliamentary constitutional monarchy", leader: "Alexander De Croo", cuisine: "Moules-Frites", currency: "Euro (EUR)" }
  },
  {
    id: "BIH", numericId: "070", iso2: "BA", name: "Bosnia and Herzegovina", officialName: "Bosnia and Herzegovina",
    continent: "Europe", subregion: "Southern Europe", capital: "Sarajevo",
    coordinates: [17.6791, 43.9159], capitalCoordinates: [18.4131, 43.8563], flagEmoji: "🇧🇦",
    facts: { politicalRegime: "Parliamentary directorial republic", leader: "Denis Bećirović", cuisine: "Ćevapi", currency: "Convertible Mark (BAM)" }
  },
  {
    id: "BGR", numericId: "100", iso2: "BG", name: "Bulgaria", officialName: "Republic of Bulgaria",
    continent: "Europe", subregion: "Eastern Europe", capital: "Sofia",
    coordinates: [25.4858, 42.7339], capitalCoordinates: [23.3219, 42.6977], flagEmoji: "🇧🇬",
    facts: { politicalRegime: "Parliamentary republic", leader: "Rumen Radev", cuisine: "Banitsa", currency: "Bulgarian Lev (BGN)" }
  },
  {
    id: "HRV", numericId: "191", iso2: "HR", name: "Croatia", officialName: "Republic of Croatia",
    continent: "Europe", subregion: "Southern Europe", capital: "Zagreb",
    coordinates: [15.2, 45.1], capitalCoordinates: [15.9819, 45.8150], flagEmoji: "🇭🇷",
    facts: { politicalRegime: "Parliamentary republic", leader: "Andrej Plenković", cuisine: "Peka", currency: "Euro (EUR)" }
  },
  {
    id: "CYP", numericId: "196", iso2: "CY", name: "Cyprus", officialName: "Republic of Cyprus",
    continent: "Europe", subregion: "Southern Europe", capital: "Nicosia",
    coordinates: [33.4299, 35.1264], capitalCoordinates: [33.3823, 35.1856], flagEmoji: "🇨🇾",
    facts: { politicalRegime: "Unitary presidential republic", leader: "Nikos Christodoulides", cuisine: "Souvla", currency: "Euro (EUR)" }
  },
  {
    id: "CZE", numericId: "203", iso2: "CZ", name: "Czechia", officialName: "Czech Republic",
    continent: "Europe", subregion: "Central Europe", capital: "Prague",
    coordinates: [15.4730, 49.8175], capitalCoordinates: [14.4378, 50.0755], flagEmoji: "🇨🇿",
    facts: { politicalRegime: "Parliamentary republic", leader: "Petr Fiala", cuisine: "Vepřo Knedlo Zelo", currency: "Czech Koruna (CZK)" }
  },
  {
    id: "DNK", numericId: "208", iso2: "DK", name: "Denmark", officialName: "Kingdom of Denmark",
    continent: "Europe", subregion: "Northern Europe", capital: "Copenhagen",
    coordinates: [9.5018, 56.2639], capitalCoordinates: [12.5683, 55.6761], flagEmoji: "🇩🇰",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Mette Frederiksen", cuisine: "Smørrebrød", currency: "Danish Krone (DKK)" }
  },
  {
    id: "EST", numericId: "233", iso2: "EE", name: "Estonia", officialName: "Republic of Estonia",
    continent: "Europe", subregion: "Northern Europe", capital: "Tallinn",
    coordinates: [25.0136, 58.5953], capitalCoordinates: [24.7536, 59.4370], flagEmoji: "🇪🇪",
    facts: { politicalRegime: "Parliamentary republic", leader: "Kristen Michal", cuisine: "Verivorst", currency: "Euro (EUR)" }
  },
  {
    id: "FIN", numericId: "246", iso2: "FI", name: "Finland", officialName: "Republic of Finland",
    continent: "Europe", subregion: "Northern Europe", capital: "Helsinki",
    coordinates: [25.7482, 61.9241], capitalCoordinates: [24.9384, 60.1699], flagEmoji: "🇫🇮",
    facts: { politicalRegime: "Parliamentary republic", leader: "Petteri Orpo", cuisine: "Karjalanpiirakka", currency: "Euro (EUR)" }
  },
  {
    id: "FRA", numericId: "250", iso2: "FR", name: "France", officialName: "French Republic",
    continent: "Europe", subregion: "Western Europe", capital: "Paris",
    coordinates: [2.2137, 46.2276], capitalCoordinates: [2.3522, 48.8566], flagEmoji: "🇫🇷",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Emmanuel Macron", cuisine: "Boeuf Bourguignon", currency: "Euro (EUR)" }
  },
  {
    id: "DEU", numericId: "276", iso2: "DE", name: "Germany", officialName: "Federal Republic of Germany",
    continent: "Europe", subregion: "Western Europe", capital: "Berlin",
    coordinates: [10.4515, 51.1657], capitalCoordinates: [13.4050, 52.5200], flagEmoji: "🇩🇪",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "Olaf Scholz", cuisine: "Sauerbraten", currency: "Euro (EUR)" }
  },
  {
    id: "GRC", numericId: "300", iso2: "GR", name: "Greece", officialName: "Hellenic Republic",
    continent: "Europe", subregion: "Southern Europe", capital: "Athens",
    coordinates: [21.8243, 39.0742], capitalCoordinates: [23.7275, 37.9838], flagEmoji: "🇬🇷",
    facts: { politicalRegime: "Parliamentary republic", leader: "Kyriakos Mitsotakis", cuisine: "Moussaka", currency: "Euro (EUR)" }
  },
  {
    id: "HUN", numericId: "348", iso2: "HU", name: "Hungary", officialName: "Hungary",
    continent: "Europe", subregion: "Central Europe", capital: "Budapest",
    coordinates: [19.5033, 47.1625], capitalCoordinates: [19.0402, 47.4979], flagEmoji: "🇭🇺",
    facts: { politicalRegime: "Parliamentary republic", leader: "Viktor Orbán", cuisine: "Goulash", currency: "Hungarian Forint (HUF)" }
  },
  {
    id: "ISL", numericId: "352", iso2: "IS", name: "Iceland", officialName: "Republic of Iceland",
    continent: "Europe", subregion: "Northern Europe", capital: "Reykjavik",
    coordinates: [-19.0208, 64.9631], capitalCoordinates: [-21.9426, 64.1466], flagEmoji: "🇮🇸",
    facts: { politicalRegime: "Parliamentary republic", leader: "Bjarni Benediktsson", cuisine: "Kjötsúpa", currency: "Icelandic Króna (ISK)" }
  },
  {
    id: "IRL", numericId: "372", iso2: "IE", name: "Ireland", officialName: "Republic of Ireland",
    continent: "Europe", subregion: "Northern Europe", capital: "Dublin",
    coordinates: [-8.2439, 53.4129], capitalCoordinates: [-6.2603, 53.3498], flagEmoji: "🇮🇪",
    facts: { politicalRegime: "Parliamentary republic", leader: "Simon Harris", cuisine: "Irish Stew", currency: "Euro (EUR)" }
  },
  {
    id: "ITA", numericId: "380", iso2: "IT", name: "Italy", officialName: "Italian Republic",
    continent: "Europe", subregion: "Southern Europe", capital: "Rome",
    coordinates: [12.5674, 41.8719], capitalCoordinates: [12.4964, 41.9028], flagEmoji: "🇮🇹",
    facts: { politicalRegime: "Parliamentary republic", leader: "Giorgia Meloni", cuisine: "Tagliatelle al Ragù", currency: "Euro (EUR)" }
  },
  {
    id: "LVA", numericId: "428", iso2: "LV", name: "Latvia", officialName: "Republic of Latvia",
    continent: "Europe", subregion: "Northern Europe", capital: "Riga",
    coordinates: [24.6032, 56.8796], capitalCoordinates: [24.1052, 56.9496], flagEmoji: "🇱🇻",
    facts: { politicalRegime: "Parliamentary republic", leader: "Evika Siliņa", cuisine: "Grey Peas with Speck", currency: "Euro (EUR)" }
  },
  {
    id: "LIE", numericId: "438", iso2: "LI", name: "Liechtenstein", officialName: "Principality of Liechtenstein",
    continent: "Europe", subregion: "Central Europe", capital: "Vaduz",
    coordinates: [9.5554, 47.1660], capitalCoordinates: [9.5209, 47.1410], flagEmoji: "🇱🇮",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Daniel Risch", cuisine: "Käsknöpfle", currency: "Swiss Franc (CHF)" }
  },
  {
    id: "LTU", numericId: "440", iso2: "LT", name: "Lithuania", officialName: "Republic of Lithuania",
    continent: "Europe", subregion: "Northern Europe", capital: "Vilnius",
    coordinates: [23.8813, 55.1694], capitalCoordinates: [25.2797, 54.6872], flagEmoji: "🇱🇹",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Ingrida Šimonytė", cuisine: "Cepelinai", currency: "Euro (EUR)" }
  },
  {
    id: "LUX", numericId: "442", iso2: "LU", name: "Luxembourg", officialName: "Grand Duchy of Luxembourg",
    continent: "Europe", subregion: "Western Europe", capital: "Luxembourg City",
    coordinates: [6.1296, 49.8153], capitalCoordinates: [6.1319, 49.6116], flagEmoji: "🇱🇺",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Luc Frieden", cuisine: "Judd mat Gaardebounen", currency: "Euro (EUR)" }
  },
  {
    id: "MLT", numericId: "470", iso2: "MT", name: "Malta", officialName: "Republic of Malta",
    continent: "Europe", subregion: "Southern Europe", capital: "Valletta",
    coordinates: [14.3754, 35.9375], capitalCoordinates: [14.5141, 35.8997], flagEmoji: "🇲🇹",
    facts: { politicalRegime: "Parliamentary republic", leader: "Robert Abela", cuisine: "Stuffat tal-Fenek", currency: "Euro (EUR)" }
  },
  {
    id: "MDA", numericId: "498", iso2: "MD", name: "Moldova", officialName: "Republic of Moldova",
    continent: "Europe", subregion: "Eastern Europe", capital: "Chisinau",
    coordinates: [28.3699, 47.4116], capitalCoordinates: [28.8638, 47.0105], flagEmoji: "🇲🇩",
    facts: { politicalRegime: "Parliamentary republic", leader: "Dorin Recean", cuisine: "Mămăligă", currency: "Moldovan Leu (MDL)" }
  },
  {
    id: "MCO", numericId: "492", iso2: "MC", name: "Monaco", officialName: "Principality of Monaco",
    continent: "Europe", subregion: "Western Europe", capital: "Monaco",
    coordinates: [7.4246, 43.7384], capitalCoordinates: [7.4246, 43.7384], flagEmoji: "🇲🇨",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Pierre Dartout", cuisine: "Barbagiuan", currency: "Euro (EUR)" }
  },
  {
    id: "MNE", numericId: "499", iso2: "ME", name: "Montenegro", officialName: "Montenegro",
    continent: "Europe", subregion: "Southern Europe", capital: "Podgorica",
    coordinates: [19.3744, 42.7087], capitalCoordinates: [19.2636, 42.4304], flagEmoji: "🇲🇪",
    facts: { politicalRegime: "Parliamentary republic", leader: "Milojko Spajić", cuisine: "Njeguški pršut", currency: "Euro (EUR)" }
  },
  {
    id: "NLD", numericId: "528", iso2: "NL", name: "Netherlands", officialName: "Kingdom of the Netherlands",
    continent: "Europe", subregion: "Western Europe", capital: "Amsterdam",
    coordinates: [5.2913, 52.1326], capitalCoordinates: [4.9041, 52.3676], flagEmoji: "🇳🇱",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Dick Schoof", cuisine: "Stamppot", currency: "Euro (EUR)" }
  },
  {
    id: "MKD", numericId: "807", iso2: "MK", name: "North Macedonia", officialName: "Republic of North Macedonia",
    continent: "Europe", subregion: "Southern Europe", capital: "Skopje",
    coordinates: [21.7453, 41.6086], capitalCoordinates: [21.4280, 41.9981], flagEmoji: "🇲🇰",
    facts: { politicalRegime: "Parliamentary republic", leader: "Hristijan Mickoski", cuisine: "Tavče Gravče", currency: "Macedonian Denar (MKD)" }
  },
  {
    id: "NOR", numericId: "578", iso2: "NO", name: "Norway", officialName: "Kingdom of Norway",
    continent: "Europe", subregion: "Northern Europe", capital: "Oslo",
    coordinates: [8.4689, 60.4720], capitalCoordinates: [10.7522, 59.9139], flagEmoji: "🇳🇴",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Jonas Gahr Støre", cuisine: "Fårikål", currency: "Norwegian Krone (NOK)" }
  },
  {
    id: "POL", numericId: "616", iso2: "PL", name: "Poland", officialName: "Republic of Poland",
    continent: "Europe", subregion: "Central Europe", capital: "Warsaw",
    coordinates: [19.1451, 51.9194], capitalCoordinates: [21.0122, 52.2297], flagEmoji: "🇵🇱",
    facts: { politicalRegime: "Parliamentary republic", leader: "Donald Tusk", cuisine: "Bigos", currency: "Polish Złoty (PLN)" }
  },
  {
    id: "PRT", numericId: "620", iso2: "PT", name: "Portugal", officialName: "Portuguese Republic",
    continent: "Europe", subregion: "Southern Europe", capital: "Lisbon",
    coordinates: [-8.2245, 39.3999], capitalCoordinates: [-9.1393, 38.7223], flagEmoji: "🇵🇹",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Luís Montenegro", cuisine: "Bacalhau à Brás", currency: "Euro (EUR)" }
  },
  {
    id: "ROU", numericId: "642", iso2: "RO", name: "Romania", officialName: "Romania",
    continent: "Europe", subregion: "Eastern Europe", capital: "Bucharest",
    coordinates: [24.9668, 45.9432], capitalCoordinates: [26.1025, 44.4268], flagEmoji: "🇷🇴",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Marcel Ciolacu", cuisine: "Sarmale", currency: "Romanian Leu (RON)" }
  },
  {
    id: "RUS", numericId: "643", iso2: "RU", name: "Russia", officialName: "Russian Federation",
    continent: "Europe", subregion: "Eastern Europe", capital: "Moscow",
    coordinates: [105.3188, 61.5240], capitalCoordinates: [37.6173, 55.7558], flagEmoji: "🇷🇺",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Vladimir Putin", cuisine: "Pelmeni", currency: "Russian Ruble (RUB)" }
  },
  {
    id: "SMR", numericId: "674", iso2: "SM", name: "San Marino", officialName: "Republic of San Marino",
    continent: "Europe", subregion: "Southern Europe", capital: "San Marino",
    coordinates: [12.4578, 43.9424], capitalCoordinates: [12.4578, 43.9424], flagEmoji: "🇸🇲",
    facts: { politicalRegime: "Parliamentary directorial republic", leader: "Captains Regent", cuisine: "Torta Tre Monti", currency: "Euro (EUR)" }
  },
  {
    id: "SRB", numericId: "688", iso2: "RS", name: "Serbia", officialName: "Republic of Serbia",
    continent: "Europe", subregion: "Southern Europe", capital: "Belgrade",
    coordinates: [21.0059, 44.0165], capitalCoordinates: [20.4489, 44.7866], flagEmoji: "🇷🇸",
    facts: { politicalRegime: "Parliamentary republic", leader: "Miloš Vučević", cuisine: "Ćevapčići", currency: "Serbian Dinar (RSD)" }
  },
  {
    id: "SVK", numericId: "703", iso2: "SK", name: "Slovakia", officialName: "Slovak Republic",
    continent: "Europe", subregion: "Central Europe", capital: "Bratislava",
    coordinates: [19.6990, 48.6690], capitalCoordinates: [17.1077, 48.1486], flagEmoji: "🇸🇰",
    facts: { politicalRegime: "Parliamentary republic", leader: "Robert Fico", cuisine: "Bryndzové Halušky", currency: "Euro (EUR)" }
  },
  {
    id: "SVN", numericId: "705", iso2: "SI", name: "Slovenia", officialName: "Republic of Slovenia",
    continent: "Europe", subregion: "Central Europe", capital: "Ljubljana",
    coordinates: [14.9955, 46.1512], capitalCoordinates: [14.5058, 46.0569], flagEmoji: "🇸🇮",
    facts: { politicalRegime: "Parliamentary republic", leader: "Robert Golob", cuisine: "Kranjska Klobasa", currency: "Euro (EUR)" }
  },
  {
    id: "ESP", numericId: "724", iso2: "ES", name: "Spain", officialName: "Kingdom of Spain",
    continent: "Europe", subregion: "Southern Europe", capital: "Madrid",
    coordinates: [-3.7492, 40.4637], capitalCoordinates: [-3.7038, 40.4168], flagEmoji: "🇪🇸",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Pedro Sánchez", cuisine: "Paella Valenciana", currency: "Euro (EUR)" }
  },
  {
    id: "SWE", numericId: "752", iso2: "SE", name: "Sweden", officialName: "Kingdom of Sweden",
    continent: "Europe", subregion: "Northern Europe", capital: "Stockholm",
    coordinates: [18.6435, 60.1282], capitalCoordinates: [18.0686, 59.3293], flagEmoji: "🇸🇪",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Ulf Kristersson", cuisine: "Köttbullar", currency: "Swedish Krona (SEK)" }
  },
  {
    id: "CHE", numericId: "756", iso2: "CH", name: "Switzerland", officialName: "Swiss Confederation",
    continent: "Europe", subregion: "Central Europe", capital: "Bern",
    coordinates: [8.2275, 46.8182], capitalCoordinates: [7.4474, 46.9480], flagEmoji: "🇨🇭",
    facts: { politicalRegime: "Federal directorial republic", leader: "Federal Council", cuisine: "Fondue", currency: "Swiss Franc (CHF)" }
  },
  {
    id: "UKR", numericId: "804", iso2: "UA", name: "Ukraine", officialName: "Ukraine",
    continent: "Europe", subregion: "Eastern Europe", capital: "Kyiv",
    coordinates: [31.1656, 48.3794], capitalCoordinates: [30.5234, 50.4501], flagEmoji: "🇺🇦",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Volodymyr Zelenskyy", cuisine: "Borscht", currency: "Ukrainian Hryvnia (UAH)" }
  },
  {
    id: "GBR", numericId: "826", iso2: "GB", name: "United Kingdom", officialName: "United Kingdom of Great Britain and Northern Ireland",
    continent: "Europe", subregion: "Northern Europe", capital: "London",
    coordinates: [-3.4360, 55.3781], capitalCoordinates: [-0.1276, 51.5074], flagEmoji: "🇬🇧",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Keir Starmer", cuisine: "Sunday Roast", currency: "Pound Sterling (GBP)" }
  },
  {
    id: "VAT", numericId: "336", iso2: "VA", name: "Vatican City", officialName: "Vatican City State",
    continent: "Europe", subregion: "Southern Europe", capital: "Vatican City",
    coordinates: [12.4534, 41.9029], capitalCoordinates: [12.4534, 41.9029], flagEmoji: "🇻🇦",
    facts: { politicalRegime: "Ecclesiastical elective monarchy", leader: "Pope Francis", cuisine: "Fettuccine alla Papalina", currency: "Euro (EUR)" }
  },

  // =========================================================================
  // ASIA (48 Sovereign Countries & Territories)
  // =========================================================================
  {
    id: "AFG", numericId: "004", iso2: "AF", name: "Afghanistan", officialName: "Islamic Emirate of Afghanistan",
    continent: "Asia", subregion: "Southern Asia", capital: "Kabul",
    coordinates: [67.709953, 33.93911], capitalCoordinates: [69.1723, 34.5553], flagEmoji: "🇦🇫",
    facts: { politicalRegime: "Theocracy", leader: "Hibatullah Akhundzada", cuisine: "Kabuli Palaw", currency: "Afghan Afghani (AFN)" }
  },
  {
    id: "ARM", numericId: "051", iso2: "AM", name: "Armenia", officialName: "Republic of Armenia",
    continent: "Asia", subregion: "Western Asia", capital: "Yerevan",
    coordinates: [45.0382, 40.0691], capitalCoordinates: [44.5152, 40.1872], flagEmoji: "🇦🇲",
    facts: { politicalRegime: "Parliamentary republic", leader: "Nikol Pashinyan", cuisine: "Khorovats", currency: "Armenian Dram (AMD)" }
  },
  {
    id: "AZE", numericId: "031", iso2: "AZ", name: "Azerbaijan", officialName: "Republic of Azerbaijan",
    continent: "Asia", subregion: "Western Asia", capital: "Baku",
    coordinates: [47.5769, 40.1431], capitalCoordinates: [49.8671, 40.4093], flagEmoji: "🇦🇿",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Ilham Aliyev", cuisine: "Plov", currency: "Azerbaijani Manat (AZN)" }
  },
  {
    id: "BHR", numericId: "048", iso2: "BH", name: "Bahrain", officialName: "Kingdom of Bahrain",
    continent: "Asia", subregion: "Western Asia", capital: "Manama",
    coordinates: [50.5577, 26.0667], capitalCoordinates: [50.5860, 26.2285], flagEmoji: "🇧🇭",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Hamad bin Isa Al Khalifa", cuisine: "Machboos", currency: "Bahraini Dinar (BHD)" }
  },
  {
    id: "BGD", numericId: "050", iso2: "BD", name: "Bangladesh", officialName: "People's Republic of Bangladesh",
    continent: "Asia", subregion: "Southern Asia", capital: "Dhaka",
    coordinates: [90.3563, 23.6850], capitalCoordinates: [90.4125, 23.8103], flagEmoji: "🇧🇩",
    facts: { politicalRegime: "Parliamentary republic", leader: "Muhammad Yunus", cuisine: "Hilsa Curry", currency: "Bangladeshi Taka (BDT)" }
  },
  {
    id: "BTN", numericId: "064", iso2: "BT", name: "Bhutan", officialName: "Kingdom of Bhutan",
    continent: "Asia", subregion: "Southern Asia", capital: "Thimphu",
    coordinates: [90.4336, 27.5142], capitalCoordinates: [89.6393, 27.4728], flagEmoji: "🇧🇹",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Tshering Tobgay", cuisine: "Ema Datshi", currency: "Bhutanese Ngultrum (BTN)" }
  },
  {
    id: "BRN", numericId: "096", iso2: "BN", name: "Brunei", officialName: "Brunei Darussalam",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Bandar Seri Begawan",
    coordinates: [114.7277, 4.5353], capitalCoordinates: [114.9481, 4.9031], flagEmoji: "🇧🇳",
    facts: { politicalRegime: "Absolute monarchy", leader: "Hassanal Bolkiah", cuisine: "Ambuyat", currency: "Brunei Dollar (BND)" }
  },
  {
    id: "KHM", numericId: "116", iso2: "KH", name: "Cambodia", officialName: "Kingdom of Cambodia",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Phnom Penh",
    coordinates: [104.9910, 12.5657], capitalCoordinates: [104.9282, 11.5564], flagEmoji: "🇰🇭",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Hun Manet", cuisine: "Fish Amok", currency: "Cambodian Riel (KHR)" }
  },
  {
    id: "CHN", numericId: "156", iso2: "CN", name: "China", officialName: "People's Republic of China",
    continent: "Asia", subregion: "Eastern Asia", capital: "Beijing",
    coordinates: [104.1954, 35.8617], capitalCoordinates: [116.4074, 39.9042], flagEmoji: "🇨🇳",
    facts: { politicalRegime: "Socialist one-party state", leader: "Xi Jinping", cuisine: "Peking Duck", currency: "Chinese Yuan (CNY)" }
  },
  {
    id: "GEO", numericId: "268", iso2: "GE", name: "Georgia", officialName: "Georgia",
    continent: "Asia", subregion: "Western Asia", capital: "Tbilisi",
    coordinates: [43.3569, 42.3154], capitalCoordinates: [44.8271, 41.7151], flagEmoji: "🇬🇪",
    facts: { politicalRegime: "Parliamentary republic", leader: "Irakli Kobakhidze", cuisine: "Khachapuri", currency: "Georgian Lari (GEL)" }
  },
  {
    id: "IND", numericId: "356", iso2: "IN", name: "India", officialName: "Republic of India",
    continent: "Asia", subregion: "Southern Asia", capital: "New Delhi",
    coordinates: [78.9629, 20.5937], capitalCoordinates: [77.2090, 28.6139], flagEmoji: "🇮🇳",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "Narendra Modi", cuisine: "Biryani", currency: "Indian Rupee (INR)" }
  },
  {
    id: "IDN", numericId: "360", iso2: "ID", name: "Indonesia", officialName: "Republic of Indonesia",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Jakarta",
    coordinates: [113.9213, -0.7893], capitalCoordinates: [106.8456, -6.2088], flagEmoji: "🇮🇩",
    facts: { politicalRegime: "Presidential republic", leader: "Prabowo Subianto", cuisine: "Nasi Goreng", currency: "Indonesian Rupiah (IDR)" }
  },
  {
    id: "IRN", numericId: "364", iso2: "IR", name: "Iran", officialName: "Islamic Republic of Iran",
    continent: "Asia", subregion: "Western Asia", capital: "Tehran",
    coordinates: [53.6880, 32.4279], capitalCoordinates: [51.3890, 35.6892], flagEmoji: "🇮🇷",
    facts: { politicalRegime: "Islamic republic", leader: "Masoud Pezeshkian", cuisine: "Ghormeh Sabzi", currency: "Iranian Rial (IRR)" }
  },
  {
    id: "IRQ", numericId: "368", iso2: "IQ", name: "Iraq", officialName: "Republic of Iraq",
    continent: "Asia", subregion: "Western Asia", capital: "Baghdad",
    coordinates: [43.6793, 33.2232], capitalCoordinates: [44.3661, 33.3152], flagEmoji: "🇮🇶",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "Mohammed Shia' Al Sudani", cuisine: "Masgouf", currency: "Iraqi Dinar (IQD)" }
  },
  {
    id: "ISR", numericId: "376", iso2: "IL", name: "Israel", officialName: "State of Israel",
    continent: "Asia", subregion: "Western Asia", capital: "Jerusalem",
    coordinates: [34.8516, 31.0461], capitalCoordinates: [35.2137, 31.7683], flagEmoji: "🇮🇱",
    facts: { politicalRegime: "Parliamentary republic", leader: "Benjamin Netanyahu", cuisine: "Falafel", currency: "Israeli New Shekel (ILS)" }
  },
  {
    id: "JPN", numericId: "392", iso2: "JP", name: "Japan", officialName: "Japan",
    continent: "Asia", subregion: "Eastern Asia", capital: "Tokyo",
    coordinates: [138.2529, 36.2048], capitalCoordinates: [139.6917, 35.6895], flagEmoji: "🇯🇵",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Shigeru Ishiba", cuisine: "Sushi", currency: "Japanese Yen (JPY)" }
  },
  {
    id: "JOR", numericId: "400", iso2: "JO", name: "Jordan", officialName: "Hashemite Kingdom of Jordan",
    continent: "Asia", subregion: "Western Asia", capital: "Amman",
    coordinates: [36.2384, 30.5852], capitalCoordinates: [35.9284, 31.9454], flagEmoji: "🇯🇴",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Abdullah II", cuisine: "Mansaf", currency: "Jordanian Dinar (JOD)" }
  },
  {
    id: "KAZ", numericId: "398", iso2: "KZ", name: "Kazakhstan", officialName: "Republic of Kazakhstan",
    continent: "Asia", subregion: "Central Asia", capital: "Astana",
    coordinates: [66.9237, 48.0196], capitalCoordinates: [71.4491, 51.1694], flagEmoji: "🇰🇿",
    facts: { politicalRegime: "Presidential republic", leader: "Kassym-Jomart Tokayev", cuisine: "Beshbarmak", currency: "Kazakhstani Tenge (KZT)" }
  },
  {
    id: "KWT", numericId: "414", iso2: "KW", name: "Kuwait", officialName: "State of Kuwait",
    continent: "Asia", subregion: "Western Asia", capital: "Kuwait City",
    coordinates: [47.4818, 29.3117], capitalCoordinates: [47.9774, 29.3759], flagEmoji: "🇰🇼",
    facts: { politicalRegime: "Constitutional emirate", leader: "Mishal Al-Ahmad Al-Jaber Al-Sabah", cuisine: "Machboos Laham", currency: "Kuwaiti Dinar (KWD)" }
  },
  {
    id: "KGZ", numericId: "417", iso2: "KG", name: "Kyrgyzstan", officialName: "Kyrgyz Republic",
    continent: "Asia", subregion: "Central Asia", capital: "Bishkek",
    coordinates: [74.7661, 41.2044], capitalCoordinates: [74.5698, 42.8746], flagEmoji: "🇰🇬",
    facts: { politicalRegime: "Presidential republic", leader: "Sadyr Japarov", cuisine: "Beshbarmak", currency: "Kyrgyzstani Som (KGS)" }
  },
  {
    id: "LAO", numericId: "418", iso2: "LA", name: "Laos", officialName: "Lao People's Democratic Republic",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Vientiane",
    coordinates: [102.4955, 19.8563], capitalCoordinates: [102.6331, 17.9757], flagEmoji: "🇱🇦",
    facts: { politicalRegime: "Socialist one-party state", leader: "Thongloun Sisoulith", cuisine: "Larb", currency: "Lao Kip (LAK)" }
  },
  {
    id: "LBN", numericId: "422", iso2: "LB", name: "Lebanon", officialName: "Republic of Lebanon",
    continent: "Asia", subregion: "Western Asia", capital: "Beirut",
    coordinates: [35.8623, 33.8547], capitalCoordinates: [35.5018, 33.8938], flagEmoji: "🇱🇧",
    facts: { politicalRegime: "Confessional parliamentary republic", leader: "Najib Mikati", cuisine: "Kibbeh", currency: "Lebanese Pound (LBP)" }
  },
  {
    id: "MYS", numericId: "458", iso2: "MY", name: "Malaysia", officialName: "Malaysia",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Kuala Lumpur",
    coordinates: [101.9758, 4.2105], capitalCoordinates: [101.6869, 3.1390], flagEmoji: "🇲🇾",
    facts: { politicalRegime: "Federal parliamentary elective monarchy", leader: "Anwar Ibrahim", cuisine: "Nasi Lemak", currency: "Malaysian Ringgit (MYR)" }
  },
  {
    id: "MDV", numericId: "462", iso2: "MV", name: "Maldives", officialName: "Republic of Maldives",
    continent: "Asia", subregion: "Southern Asia", capital: "Male",
    coordinates: [73.2207, 3.2028], capitalCoordinates: [73.5093, 4.1755], flagEmoji: "🇲🇻",
    facts: { politicalRegime: "Presidential republic", leader: "Mohamed Muizzu", cuisine: "Garudhiya", currency: "Maldivian Rufiyaa (MVR)" }
  },
  {
    id: "MNG", numericId: "496", iso2: "MN", name: "Mongolia", officialName: "Mongolia",
    continent: "Asia", subregion: "Eastern Asia", capital: "Ulaanbaatar",
    coordinates: [103.8467, 46.8625], capitalCoordinates: [106.9057, 47.8864], flagEmoji: "🇲🇳",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Luvsannamsrain Oyun-Erdene", cuisine: "Buuz", currency: "Mongolian Tögrög (MNT)" }
  },
  {
    id: "MMR", numericId: "104", iso2: "MM", name: "Myanmar", officialName: "Republic of the Union of Myanmar",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Naypyidaw",
    coordinates: [95.9560, 21.9162], capitalCoordinates: [96.0785, 19.7633], flagEmoji: "🇲🇲",
    facts: { politicalRegime: "Military junta", leader: "Min Aung Hlaing", cuisine: "Mohinga", currency: "Myanmar Kyat (MMK)" }
  },
  {
    id: "NPL", numericId: "524", iso2: "NP", name: "Nepal", officialName: "Federal Democratic Republic of Nepal",
    continent: "Asia", subregion: "Southern Asia", capital: "Kathmandu",
    coordinates: [84.1240, 28.3949], capitalCoordinates: [85.3240, 27.7172], flagEmoji: "🇳🇵",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "K.P. Sharma Oli", cuisine: "Dal Bhat", currency: "Nepalese Rupee (NPR)" }
  },
  {
    id: "PRK", numericId: "408", iso2: "KP", name: "North Korea", officialName: "Democratic People's Republic of Korea",
    continent: "Asia", subregion: "Eastern Asia", capital: "Pyongyang",
    coordinates: [127.5101, 40.3399], capitalCoordinates: [125.7625, 39.0392], flagEmoji: "🇰🇵",
    facts: { politicalRegime: "Totalitarian dictatorship", leader: "Kim Jong Un", cuisine: "Naengmyeon", currency: "North Korean Won (KPW)" }
  },
  {
    id: "OMN", numericId: "512", iso2: "OM", name: "Oman", officialName: "Sultanate of Oman",
    continent: "Asia", subregion: "Western Asia", capital: "Muscat",
    coordinates: [55.9233, 21.5126], capitalCoordinates: [58.4059, 23.5880], flagEmoji: "🇴🇲",
    facts: { politicalRegime: "Absolute monarchy", leader: "Haitham bin Tariq", cuisine: "Shuwa", currency: "Omani Rial (OMR)" }
  },
  {
    id: "PAK", numericId: "586", iso2: "PK", name: "Pakistan", officialName: "Islamic Republic of Pakistan",
    continent: "Asia", subregion: "Southern Asia", capital: "Islamabad",
    coordinates: [69.3451, 30.3753], capitalCoordinates: [73.0479, 33.6844], flagEmoji: "🇵🇰",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "Shehbaz Sharif", cuisine: "Nihari", currency: "Pakistani Rupee (PKR)" }
  },
  {
    id: "PSE", numericId: "275", iso2: "PS", name: "Palestine", officialName: "State of Palestine",
    continent: "Asia", subregion: "Western Asia", capital: "Ramallah",
    coordinates: [35.2332, 31.9522], capitalCoordinates: [35.2042, 31.9038], flagEmoji: "🇵🇸",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Mahmoud Abbas", cuisine: "Musakhan", currency: "Israeli New Shekel / Jordanian Dinar" }
  },
  {
    id: "PHL", numericId: "608", iso2: "PH", name: "Philippines", officialName: "Republic of the Philippines",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Manila",
    coordinates: [121.7740, 12.8797], capitalCoordinates: [120.9842, 14.5995], flagEmoji: "🇵🇭",
    facts: { politicalRegime: "Presidential republic", leader: "Bongbong Marcos", cuisine: "Adobo", currency: "Philippine Peso (PHP)" }
  },
  {
    id: "QAT", numericId: "634", iso2: "QA", name: "Qatar", officialName: "State of Qatar",
    continent: "Asia", subregion: "Western Asia", capital: "Doha",
    coordinates: [51.1839, 25.3548], capitalCoordinates: [51.5310, 25.2854], flagEmoji: "🇶🇦",
    facts: { politicalRegime: "Semi-constitutional monarchy", leader: "Tamim bin Hamad Al Thani", cuisine: "Machboos", currency: "Qatari Riyal (QAR)" }
  },
  {
    id: "SAU", numericId: "682", iso2: "SA", name: "Saudi Arabia", officialName: "Kingdom of Saudi Arabia",
    continent: "Asia", subregion: "Western Asia", capital: "Riyadh",
    coordinates: [45.0792, 23.8859], capitalCoordinates: [46.6753, 24.7136], flagEmoji: "🇸🇦",
    facts: { politicalRegime: "Absolute monarchy", leader: "Mohammed bin Salman", cuisine: "Kabsa", currency: "Saudi Riyal (SAR)" }
  },
  {
    id: "SGP", numericId: "702", iso2: "SG", name: "Singapore", officialName: "Republic of Singapore",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Singapore",
    coordinates: [103.8198, 1.3521], capitalCoordinates: [103.8198, 1.3521], flagEmoji: "🇸🇬",
    facts: { politicalRegime: "Parliamentary republic", leader: "Lawrence Wong", cuisine: "Hainanese Chicken Rice", currency: "Singapore Dollar (SGD)" }
  },
  {
    id: "KOR", numericId: "410", iso2: "KR", name: "South Korea", officialName: "Republic of Korea",
    continent: "Asia", subregion: "Eastern Asia", capital: "Seoul",
    coordinates: [127.7669, 35.9078], capitalCoordinates: [126.9780, 37.5665], flagEmoji: "🇰🇷",
    facts: { politicalRegime: "Presidential republic", leader: "Yoon Suk Yeol", cuisine: "Kimchi & Bulgogi", currency: "South Korean Won (KRW)" }
  },
  {
    id: "LKA", numericId: "144", iso2: "LK", name: "Sri Lanka", officialName: "Democratic Socialist Republic of Sri Lanka",
    continent: "Asia", subregion: "Southern Asia", capital: "Sri Jayawardenepura Kotte",
    coordinates: [80.7718, 7.8731], capitalCoordinates: [79.9198, 6.9117], flagEmoji: "🇱🇰",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Anura Kumara Dissanayake", cuisine: "Rice and Curry", currency: "Sri Lankan Rupee (LKR)" }
  },
  {
    id: "SYR", numericId: "760", iso2: "SY", name: "Syria", officialName: "Syrian Arab Republic",
    continent: "Asia", subregion: "Western Asia", capital: "Damascus",
    coordinates: [38.9968, 34.8021], capitalCoordinates: [36.2765, 33.5138], flagEmoji: "🇸🇾",
    facts: { politicalRegime: "Presidential republic", leader: "Bashar al-Assad", cuisine: "Kibbeh Bil Sanieh", currency: "Syrian Pound (SYP)" }
  },
  {
    id: "TWN", numericId: "158", iso2: "TW", name: "Taiwan", officialName: "Republic of China",
    continent: "Asia", subregion: "Eastern Asia", capital: "Taipei",
    coordinates: [120.9605, 23.6978], capitalCoordinates: [121.5654, 25.0330], flagEmoji: "🇹🇼",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Lai Ching-te", cuisine: "Beef Noodle Soup", currency: "New Taiwan Dollar (TWD)" }
  },
  {
    id: "TJK", numericId: "762", iso2: "TJ", name: "Tajikistan", officialName: "Republic of Tajikistan",
    continent: "Asia", subregion: "Central Asia", capital: "Dushanbe",
    coordinates: [71.2761, 38.8610], capitalCoordinates: [68.7864, 38.5598], flagEmoji: "🇹🇯",
    facts: { politicalRegime: "Presidential republic", leader: "Emomali Rahmon", cuisine: "Qurutob", currency: "Tajikistani Somoni (TJS)" }
  },
  {
    id: "THA", numericId: "764", iso2: "TH", name: "Thailand", officialName: "Kingdom of Thailand",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Bangkok",
    coordinates: [100.9925, 15.8700], capitalCoordinates: [100.5018, 13.7563], flagEmoji: "🇹🇭",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Paetongtarn Shinawatra", cuisine: "Pad Thai", currency: "Thai Baht (THB)" }
  },
  {
    id: "TLS", numericId: "626", iso2: "TL", name: "Timor-Leste", officialName: "Democratic Republic of Timor-Leste",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Dili",
    coordinates: [125.7275, -8.8742], capitalCoordinates: [125.5736, -8.5569], flagEmoji: "🇹🇱",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Xanana Gusmão", cuisine: "Ikan Bakar", currency: "United States Dollar (USD)" }
  },
  {
    id: "TUR", numericId: "792", iso2: "TR", name: "Turkey", officialName: "Republic of Turkey",
    continent: "Asia", subregion: "Western Asia", capital: "Ankara",
    coordinates: [35.2433, 38.9637], capitalCoordinates: [32.8597, 39.9334], flagEmoji: "🇹🇷",
    facts: { politicalRegime: "Presidential republic", leader: "Recep Tayyip Erdoğan", cuisine: "Kebab & Baklava", currency: "Turkish Lira (TRY)" }
  },
  {
    id: "TKM", numericId: "795", iso2: "TM", name: "Turkmenistan", officialName: "Turkmenistan",
    continent: "Asia", subregion: "Central Asia", capital: "Ashgabat",
    coordinates: [59.5563, 38.9697], capitalCoordinates: [58.3261, 37.9601], flagEmoji: "🇹🇲",
    facts: { politicalRegime: "Presidential republic", leader: "Serdar Berdimuhamedow", cuisine: "Shashlyk", currency: "Turkmenistan Manat (TMT)" }
  },
  {
    id: "ARE", numericId: "784", iso2: "AE", name: "United Arab Emirates", officialName: "United Arab Emirates",
    continent: "Asia", subregion: "Western Asia", capital: "Abu Dhabi",
    coordinates: [53.8478, 23.4241], capitalCoordinates: [54.3773, 24.4539], flagEmoji: "🇦🇪",
    facts: { politicalRegime: "Federal elective monarchy", leader: "Mohamed bin Zayed Al Nahyan", cuisine: "Al Harees", currency: "UAE Dirham (AED)" }
  },
  {
    id: "UZB", numericId: "860", iso2: "UZ", name: "Uzbekistan", officialName: "Republic of Uzbekistan",
    continent: "Asia", subregion: "Central Asia", capital: "Tashkent",
    coordinates: [64.5853, 41.3775], capitalCoordinates: [69.2401, 41.2995], flagEmoji: "🇺🇿",
    facts: { politicalRegime: "Presidential republic", leader: "Shavkat Mirziyoyev", cuisine: "Palov", currency: "Uzbekistani Som (UZS)" }
  },
  {
    id: "VNM", numericId: "704", iso2: "VN", name: "Vietnam", officialName: "Socialist Republic of Vietnam",
    continent: "Asia", subregion: "South-Eastern Asia", capital: "Hanoi",
    coordinates: [108.2772, 14.0583], capitalCoordinates: [105.8342, 21.0278], flagEmoji: "🇻🇳",
    facts: { politicalRegime: "Socialist one-party state", leader: "To Lam", cuisine: "Phở", currency: "Vietnamese Đồng (VND)" }
  },
  {
    id: "YEM", numericId: "887", iso2: "YE", name: "Yemen", officialName: "Republic of Yemen",
    continent: "Asia", subregion: "Western Asia", capital: "Sana'a",
    coordinates: [48.5164, 15.5527], capitalCoordinates: [44.2081, 15.3694], flagEmoji: "🇾🇪",
    facts: { politicalRegime: "Presidential republic", leader: "Rashad al-Alimi", cuisine: "Saltah", currency: "Yemeni Rial (YER)" }
  },

  // =========================================================================
  // AFRICA (54 Sovereign Countries)
  // =========================================================================
  {
    id: "DZA", numericId: "012", iso2: "DZ", name: "Algeria", officialName: "People's Democratic Republic of Algeria",
    continent: "Africa", subregion: "Northern Africa", capital: "Algiers",
    coordinates: [1.6596, 28.0339], capitalCoordinates: [3.0588, 36.7538], flagEmoji: "🇩🇿",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Abdelmadjid Tebboune", cuisine: "Couscous", currency: "Algerian Dinar (DZD)" }
  },
  {
    id: "AGO", numericId: "024", iso2: "AO", name: "Angola", officialName: "Republic of Angola",
    continent: "Africa", subregion: "Middle Africa", capital: "Luanda",
    coordinates: [17.8739, -11.2027], capitalCoordinates: [13.2343, -8.8390], flagEmoji: "🇦🇴",
    facts: { politicalRegime: "Presidential republic", leader: "João Lourenço", cuisine: "Muamba de Galinha", currency: "Angolan Kwanza (AOA)" }
  },
  {
    id: "BEN", numericId: "204", iso2: "BJ", name: "Benin", officialName: "Republic of Benin",
    continent: "Africa", subregion: "Western Africa", capital: "Porto-Novo",
    coordinates: [2.3158, 9.3077], capitalCoordinates: [2.6036, 6.4969], flagEmoji: "🇧🇯",
    facts: { politicalRegime: "Presidential republic", leader: "Patrice Talon", cuisine: "Kuli Kuli", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "BWA", numericId: "072", iso2: "BW", name: "Botswana", officialName: "Republic of Botswana",
    continent: "Africa", subregion: "Southern Africa", capital: "Gaborone",
    coordinates: [24.6849, -22.3285], capitalCoordinates: [25.9231, -24.6581], flagEmoji: "🇧🇼",
    facts: { politicalRegime: "Parliamentary republic", leader: "Duma Boko", cuisine: "Seswaa", currency: "Botswana Pula (BWP)" }
  },
  {
    id: "BFA", numericId: "854", iso2: "BF", name: "Burkina Faso", officialName: "Burkina Faso",
    continent: "Africa", subregion: "Western Africa", capital: "Ouagadougou",
    coordinates: [-1.5616, 12.2383], capitalCoordinates: [-1.5197, 12.3714], flagEmoji: "🇧🇫",
    facts: { politicalRegime: "Military junta", leader: "Ibrahim Traoré", cuisine: "Riz Gras", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "BDI", numericId: "108", iso2: "BI", name: "Burundi", officialName: "Republic of Burundi",
    continent: "Africa", subregion: "Eastern Africa", capital: "Gitega",
    coordinates: [29.9189, -3.3731], capitalCoordinates: [29.9246, -3.4278], flagEmoji: "🇧🇮",
    facts: { politicalRegime: "Presidential republic", leader: "Évariste Ndayishimiye", cuisine: "Boko Boko Harees", currency: "Burundian Franc (BIF)" }
  },
  {
    id: "CPV", numericId: "132", iso2: "CV", name: "Cabo Verde", officialName: "Republic of Cabo Verde",
    continent: "Africa", subregion: "Western Africa", capital: "Praia",
    coordinates: [-23.6052, 15.1111], capitalCoordinates: [-23.5133, 14.9331], flagEmoji: "🇨🇻",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Ulisses Correia e Silva", cuisine: "Cachupa", currency: "Cape Verdean Escudo (CVE)" }
  },
  {
    id: "CMR", numericId: "120", iso2: "CM", name: "Cameroon", officialName: "Republic of Cameroon",
    continent: "Africa", subregion: "Middle Africa", capital: "Yaounde",
    coordinates: [12.3547, 7.3697], capitalCoordinates: [11.5174, 3.8480], flagEmoji: "🇨🇲",
    facts: { politicalRegime: "Presidential republic", leader: "Paul Biya", cuisine: "Ndole", currency: "Central African CFA Franc (XAF)" }
  },
  {
    id: "CAF", numericId: "140", iso2: "CF", name: "Central African Republic", officialName: "Central African Republic",
    continent: "Africa", subregion: "Middle Africa", capital: "Bangui",
    coordinates: [20.9394, 6.6111], capitalCoordinates: [18.5582, 4.3947], flagEmoji: "🇨🇫",
    facts: { politicalRegime: "Presidential republic", leader: "Faustin-Archange Touadéra", cuisine: "Cassava leaves (Kanda)", currency: "Central African CFA Franc (XAF)" }
  },
  {
    id: "TCD", numericId: "148", iso2: "TD", name: "Chad", officialName: "Republic of Chad",
    continent: "Africa", subregion: "Middle Africa", capital: "N'Djamena",
    coordinates: [18.7322, 15.4542], capitalCoordinates: [15.0444, 12.1348], flagEmoji: "🇹🇩",
    facts: { politicalRegime: "Presidential republic", leader: "Mahamat Déby", cuisine: "Daraba", currency: "Central African CFA Franc (XAF)" }
  },
  {
    id: "COM", numericId: "174", iso2: "KM", name: "Comoros", officialName: "Union of the Comoros",
    continent: "Africa", subregion: "Eastern Africa", capital: "Moroni",
    coordinates: [43.8726, -11.8790], capitalCoordinates: [43.2551, -11.7172], flagEmoji: "🇰🇲",
    facts: { politicalRegime: "Federal presidential republic", leader: "Azali Assoumani", cuisine: "Langouste à la vanille", currency: "Comorian Franc (KMF)" }
  },
  {
    id: "COG", numericId: "178", iso2: "CG", name: "Republic of the Congo", officialName: "Republic of the Congo",
    continent: "Africa", subregion: "Middle Africa", capital: "Brazzaville",
    coordinates: [15.8277, -0.2280], capitalCoordinates: [15.2832, -4.2634], flagEmoji: "🇨🇬",
    facts: { politicalRegime: "Presidential republic", leader: "Denis Sassou Nguesso", cuisine: "Saka Saka", currency: "Central African CFA Franc (XAF)" }
  },
  {
    id: "COD", numericId: "180", iso2: "CD", name: "DR Congo", officialName: "Democratic Republic of the Congo",
    continent: "Africa", subregion: "Middle Africa", capital: "Kinshasa",
    coordinates: [21.7587, -4.0383], capitalCoordinates: [15.3136, -4.3217], flagEmoji: "🇨🇩",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Félix Tshisekedi", cuisine: "Moambe Chicken", currency: "Congolese Franc (CDF)" }
  },
  {
    id: "CIV", numericId: "384", iso2: "CI", name: "Ivory Coast", officialName: "Republic of Côte d'Ivoire",
    continent: "Africa", subregion: "Western Africa", capital: "Yamoussoukro",
    coordinates: [-5.5471, 7.5400], capitalCoordinates: [-5.2767, 6.8276], flagEmoji: "🇨🇮",
    facts: { politicalRegime: "Presidential republic", leader: "Alassane Ouattara", cuisine: "Garba / Attiéké", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "DJI", numericId: "262", iso2: "DJ", name: "Djibouti", officialName: "Republic of Djibouti",
    continent: "Africa", subregion: "Eastern Africa", capital: "Djibouti",
    coordinates: [42.5903, 11.8251], capitalCoordinates: [43.1456, 11.5890], flagEmoji: "🇩🇯",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Ismaïl Omar Guelleh", cuisine: "Skoudehkaris", currency: "Djiboutian Franc (DJF)" }
  },
  {
    id: "EGY", numericId: "818", iso2: "EG", name: "Egypt", officialName: "Arab Republic of Egypt",
    continent: "Africa", subregion: "Northern Africa", capital: "Cairo",
    coordinates: [30.8025, 26.8206], capitalCoordinates: [31.2357, 30.0444], flagEmoji: "🇪🇬",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Abdel Fattah el-Sisi", cuisine: "Koshary", currency: "Egyptian Pound (EGP)" }
  },
  {
    id: "GNQ", numericId: "226", iso2: "GQ", name: "Equatorial Guinea", officialName: "Republic of Equatorial Guinea",
    continent: "Africa", subregion: "Middle Africa", capital: "Malabo",
    coordinates: [10.2679, 1.6508], capitalCoordinates: [8.7832, 3.7504], flagEmoji: "🇬🇶",
    facts: { politicalRegime: "Presidential republic", leader: "Teodoro Obiang Nguema Mbasogo", cuisine: "Succotash", currency: "Central African CFA Franc (XAF)" }
  },
  {
    id: "ERI", numericId: "232", iso2: "ER", name: "Eritrea", officialName: "State of Eritrea",
    continent: "Africa", subregion: "Eastern Africa", capital: "Asmara",
    coordinates: [39.7823, 15.1794], capitalCoordinates: [38.9251, 15.3229], flagEmoji: "🇪🇷",
    facts: { politicalRegime: "One-party presidential republic", leader: "Isaias Afwerki", cuisine: "Zigni with Injera", currency: "Eritrean Nakfa (ERN)" }
  },
  {
    id: "SWZ", numericId: "748", iso2: "SZ", name: "Eswatini", officialName: "Kingdom of Eswatini",
    continent: "Africa", subregion: "Southern Africa", capital: "Mbabane",
    coordinates: [31.4659, -26.5225], capitalCoordinates: [31.1333, -26.3167], flagEmoji: "🇸🇿",
    facts: { politicalRegime: "Absolute monarchy", leader: "Mswati III", cuisine: "Umncweba", currency: "Swazi Lilangeni (SZL)" }
  },
  {
    id: "ETH", numericId: "231", iso2: "ET", name: "Ethiopia", officialName: "Federal Democratic Republic of Ethiopia",
    continent: "Africa", subregion: "Eastern Africa", capital: "Addis Ababa",
    coordinates: [40.4897, 9.1450], capitalCoordinates: [38.7469, 9.0320], flagEmoji: "🇪🇹",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "Abiy Ahmed", cuisine: "Doro Wat with Injera", currency: "Ethiopian Birr (ETB)" }
  },
  {
    id: "GAB", numericId: "266", iso2: "GA", name: "Gabon", officialName: "Gabonese Republic",
    continent: "Africa", subregion: "Middle Africa", capital: "Libreville",
    coordinates: [11.6094, -0.8037], capitalCoordinates: [9.4673, 0.4162], flagEmoji: "🇬🇦",
    facts: { politicalRegime: "Military junta / Transitional", leader: "Brice Oligui Nguema", cuisine: "Poulet Nyembwe", currency: "Central African CFA Franc (XAF)" }
  },
  {
    id: "GMB", numericId: "270", iso2: "GM", name: "Gambia", officialName: "Republic of the Gambia",
    continent: "Africa", subregion: "Western Africa", capital: "Banjul",
    coordinates: [-15.3101, 13.4432], capitalCoordinates: [-16.5790, 13.4549], flagEmoji: "🇬🇲",
    facts: { politicalRegime: "Presidential republic", leader: "Adama Barrow", cuisine: "Domoda", currency: "Gambian Dalasi (GMD)" }
  },
  {
    id: "GHA", numericId: "288", iso2: "GH", name: "Ghana", officialName: "Republic of Ghana",
    continent: "Africa", subregion: "Western Africa", capital: "Accra",
    coordinates: [-1.0232, 7.9465], capitalCoordinates: [-0.1870, 5.6037], flagEmoji: "🇬🇭",
    facts: { politicalRegime: "Presidential republic", leader: "Nana Akufo-Addo", cuisine: "Jollof Rice", currency: "Ghanaian Cedi (GHS)" }
  },
  {
    id: "GIN", numericId: "324", iso2: "GN", name: "Guinea", officialName: "Republic of Guinea",
    continent: "Africa", subregion: "Western Africa", capital: "Conakry",
    coordinates: [-9.6966, 9.9456], capitalCoordinates: [-13.6773, 9.5092], flagEmoji: "🇬🇳",
    facts: { politicalRegime: "Military junta", leader: "Mamady Doumbouya", cuisine: "Poulet Yassa", currency: "Guinean Franc (GNF)" }
  },
  {
    id: "GNB", numericId: "624", iso2: "GW", name: "Guinea-Bissau", officialName: "Republic of Guinea-Bissau",
    continent: "Africa", subregion: "Western Africa", capital: "Bissau",
    coordinates: [-15.1804, 11.8037], capitalCoordinates: [-15.5977, 11.8632], flagEmoji: "🇬🇼",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Umaro Sissoco Embaló", cuisine: "Caldo de Mancarra", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "KEN", numericId: "404", iso2: "KE", name: "Kenya", officialName: "Republic of Kenya",
    continent: "Africa", subregion: "Eastern Africa", capital: "Nairobi",
    coordinates: [37.9062, -0.0236], capitalCoordinates: [36.8219, -1.2921], flagEmoji: "🇰🇪",
    facts: { politicalRegime: "Presidential republic", leader: "William Ruto", cuisine: "Ugali with Sukuma Wiki", currency: "Kenyan Shilling (KES)" }
  },
  {
    id: "LSO", numericId: "426", iso2: "LS", name: "Lesotho", officialName: "Kingdom of Lesotho",
    continent: "Africa", subregion: "Southern Africa", capital: "Maseru",
    coordinates: [28.2336, -29.6099], capitalCoordinates: [27.4833, -29.3167], flagEmoji: "🇱🇸",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Sam Matekane", cuisine: "Papa and Morogo", currency: "Lesotho Loti (LSL)" }
  },
  {
    id: "LBR", numericId: "430", iso2: "LR", name: "Liberia", officialName: "Republic of Liberia",
    continent: "Africa", subregion: "Western Africa", capital: "Monrovia",
    coordinates: [-9.4295, 6.4281], capitalCoordinates: [-10.7969, 6.3005], flagEmoji: "🇱🇷",
    facts: { politicalRegime: "Presidential republic", leader: "Joseph Boakai", cuisine: "Palm Butter Soup", currency: "Liberian Dollar (LRD)" }
  },
  {
    id: "LBY", numericId: "434", iso2: "LY", name: "Libya", officialName: "State of Libya",
    continent: "Africa", subregion: "Northern Africa", capital: "Tripoli",
    coordinates: [17.2283, 26.3351], capitalCoordinates: [13.1913, 32.8872], flagEmoji: "🇱🇾",
    facts: { politicalRegime: "Transitional government", leader: "Abdul Hamid Dbeibeh", cuisine: "Bazeen", currency: "Libyan Dinar (LYD)" }
  },
  {
    id: "MDG", numericId: "450", iso2: "MG", name: "Madagascar", officialName: "Republic of Madagascar",
    continent: "Africa", subregion: "Eastern Africa", capital: "Antananarivo",
    coordinates: [46.8691, -18.7669], capitalCoordinates: [47.5079, -18.8792], flagEmoji: "🇲🇬",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Andry Rajoelina", cuisine: "Romazava", currency: "Malagasy Ariary (MGA)" }
  },
  {
    id: "MWI", numericId: "454", iso2: "MW", name: "Malawi", officialName: "Republic of Malawi",
    continent: "Africa", subregion: "Eastern Africa", capital: "Lilongwe",
    coordinates: [34.3015, -13.2543], capitalCoordinates: [33.7873, -13.9626], flagEmoji: "🇲🇼",
    facts: { politicalRegime: "Presidential republic", leader: "Lazarus Chakwera", cuisine: "Nsima with Chambo", currency: "Malawian Kwacha (MWK)" }
  },
  {
    id: "MLI", numericId: "466", iso2: "ML", name: "Mali", officialName: "Republic of Mali",
    continent: "Africa", subregion: "Western Africa", capital: "Bamako",
    coordinates: [-3.9962, 17.5707], capitalCoordinates: [-8.0029, 12.6392], flagEmoji: "🇲🇱",
    facts: { politicalRegime: "Military junta", leader: "Assimi Goïta", cuisine: "Tiguadege Na (Peanut stew)", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "MRT", numericId: "478", iso2: "MR", name: "Mauritania", officialName: "Islamic Republic of Mauritania",
    continent: "Africa", subregion: "Western Africa", capital: "Nouakchott",
    coordinates: [-10.9408, 21.0079], capitalCoordinates: [-15.9582, 18.0735], flagEmoji: "🇲🇷",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Mohamed Ould Ghazouani", cuisine: "Thieboudienne", currency: "Mauritanian Ouguiya (MRU)" }
  },
  {
    id: "MUS", numericId: "480", iso2: "MU", name: "Mauritius", officialName: "Republic of Mauritius",
    continent: "Africa", subregion: "Eastern Africa", capital: "Port Louis",
    coordinates: [57.5522, -20.3484], capitalCoordinates: [57.5012, -20.1609], flagEmoji: "🇲🇺",
    facts: { politicalRegime: "Parliamentary republic", leader: "Navin Ramgoolam", cuisine: "Dholl Puri", currency: "Mauritian Rupee (MUR)" }
  },
  {
    id: "MAR", numericId: "504", iso2: "MA", name: "Morocco", officialName: "Kingdom of Morocco",
    continent: "Africa", subregion: "Northern Africa", capital: "Rabat",
    coordinates: [-7.0926, 31.7917], capitalCoordinates: [-6.8498, 34.0209], flagEmoji: "🇲🇦",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Aziz Akhannouch", cuisine: "Tagine", currency: "Moroccan Dirham (MAD)" }
  },
  {
    id: "MOZ", numericId: "508", iso2: "MZ", name: "Mozambique", officialName: "Republic of Mozambique",
    continent: "Africa", subregion: "Eastern Africa", capital: "Maputo",
    coordinates: [35.5296, -18.6657], capitalCoordinates: [32.5732, -25.9692], flagEmoji: "🇲🇿",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Daniel Chapo", cuisine: "Peri-Peri Chicken", currency: "Mozambican Metical (MZN)" }
  },
  {
    id: "NAM", numericId: "516", iso2: "NA", name: "Namibia", officialName: "Republic of Namibia",
    continent: "Africa", subregion: "Southern Africa", capital: "Windhoek",
    coordinates: [18.4904, -22.9576], capitalCoordinates: [17.0658, -22.5609], flagEmoji: "🇳🇦",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Nangolo Mbumba", cuisine: "Kapana", currency: "Namibian Dollar (NAD)" }
  },
  {
    id: "NER", numericId: "562", iso2: "NE", name: "Niger", officialName: "Republic of the Niger",
    continent: "Africa", subregion: "Western Africa", capital: "Niamey",
    coordinates: [8.0817, 17.6078], capitalCoordinates: [2.1254, 13.5116], flagEmoji: "🇳🇪",
    facts: { politicalRegime: "Military junta", leader: "Abdourahamane Tchiani", cuisine: "Djerma stew", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "NGA", numericId: "566", iso2: "NG", name: "Nigeria", officialName: "Federal Republic of Nigeria",
    continent: "Africa", subregion: "Western Africa", capital: "Abuja",
    coordinates: [8.6753, 9.0820], capitalCoordinates: [7.4951, 9.0579], flagEmoji: "🇳🇬",
    facts: { politicalRegime: "Federal presidential republic", leader: "Bola Tinubu", cuisine: "Jollof Rice & Egusi", currency: "Nigerian Naira (NGN)" }
  },
  {
    id: "RWA", numericId: "646", iso2: "RW", name: "Rwanda", officialName: "Republic of Rwanda",
    continent: "Africa", subregion: "Eastern Africa", capital: "Kigali",
    coordinates: [29.8739, -1.9403], capitalCoordinates: [30.0619, -1.9441], flagEmoji: "🇷🇼",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Paul Kagame", cuisine: "Isombe", currency: "Rwandan Franc (RWF)" }
  },
  {
    id: "STP", numericId: "678", iso2: "ST", name: "Sao Tome and Principe", officialName: "Democratic Republic of Sao Tome and Principe",
    continent: "Africa", subregion: "Middle Africa", capital: "Sao Tome",
    coordinates: [6.6131, 0.1864], capitalCoordinates: [6.7273, 0.3365], flagEmoji: "🇸🇹",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Patrice Trovoada", cuisine: "Calulu", currency: "São Tomé and Príncipe Dobra (STN)" }
  },
  {
    id: "SEN", numericId: "686", iso2: "SN", name: "Senegal", officialName: "Republic of Senegal",
    continent: "Africa", subregion: "Western Africa", capital: "Dakar",
    coordinates: [-14.4524, 14.4974], capitalCoordinates: [-17.4441, 14.6928], flagEmoji: "🇸🇳",
    facts: { politicalRegime: "Presidential republic", leader: "Bassirou Diomaye Faye", cuisine: "Thieboudienne", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "SYC", numericId: "690", iso2: "SC", name: "Seychelles", officialName: "Republic of Seychelles",
    continent: "Africa", subregion: "Eastern Africa", capital: "Victoria",
    coordinates: [55.4920, -4.6796], capitalCoordinates: [55.4513, -4.6233], flagEmoji: "🇸🇨",
    facts: { politicalRegime: "Presidential republic", leader: "Wavel Ramkalawan", cuisine: "Grilled Fish with Creole sauce", currency: "Seychellois Rupee (SCR)" }
  },
  {
    id: "SLE", numericId: "694", iso2: "SL", name: "Sierra Leone", officialName: "Republic of Sierra Leone",
    continent: "Africa", subregion: "Western Africa", capital: "Freetown",
    coordinates: [-11.7799, 8.4606], capitalCoordinates: [-13.2317, 8.4840], flagEmoji: "🇸🇱",
    facts: { politicalRegime: "Presidential republic", leader: "Julius Maada Bio", cuisine: "Cassava leaves stew", currency: "Sierra Leonean Leone (SLL)" }
  },
  {
    id: "SOM", numericId: "706", iso2: "SO", name: "Somalia", officialName: "Federal Republic of Somalia",
    continent: "Africa", subregion: "Eastern Africa", capital: "Mogadishu",
    coordinates: [46.1996, 5.1521], capitalCoordinates: [45.3182, 2.0469], flagEmoji: "🇸🇴",
    facts: { politicalRegime: "Federal parliamentary republic", leader: "Hassan Sheikh Mohamud", cuisine: "Bariis Iskukaris", currency: "Somali Shilling (SOS)" }
  },
  {
    id: "ZAF", numericId: "710", iso2: "ZA", name: "South Africa", officialName: "Republic of South Africa",
    continent: "Africa", subregion: "Southern Africa", capital: "Pretoria",
    coordinates: [22.9375, -30.5595], capitalCoordinates: [28.2293, -25.7479], flagEmoji: "🇿🇦",
    facts: { politicalRegime: "Parliamentary republic", leader: "Cyril Ramaphosa", cuisine: "Bobotie & Braai", currency: "South African Rand (ZAR)" }
  },
  {
    id: "SSD", numericId: "728", iso2: "SS", name: "South Sudan", officialName: "Republic of South Sudan",
    continent: "Africa", subregion: "Eastern Africa", capital: "Juba",
    coordinates: [31.3070, 6.8770], capitalCoordinates: [31.5713, 4.8594], flagEmoji: "🇸🇸",
    facts: { politicalRegime: "Presidential republic", leader: "Salva Kiir Mayardit", cuisine: "Kisra", currency: "South Sudanese Pound (SSP)" }
  },
  {
    id: "SDN", numericId: "729", iso2: "SD", name: "Sudan", officialName: "Republic of the Sudan",
    continent: "Africa", subregion: "Northern Africa", capital: "Khartoum",
    coordinates: [30.2176, 12.8628], capitalCoordinates: [32.5599, 15.5007], flagEmoji: "🇸🇩",
    facts: { politicalRegime: "Military junta", leader: "Abdel Fattah al-Burhan", cuisine: "Ful Medames", currency: "Sudanese Pound (SDG)" }
  },
  {
    id: "TZA", numericId: "834", iso2: "TZ", name: "Tanzania", officialName: "United Republic of Tanzania",
    continent: "Africa", subregion: "Eastern Africa", capital: "Dodoma",
    coordinates: [34.8888, -6.3690], capitalCoordinates: [35.7516, -6.1630], flagEmoji: "🇹🇿",
    facts: { politicalRegime: "Presidential republic", leader: "Samia Suluhu Hassan", cuisine: "Ugali & Nyama Choma", currency: "Tanzanian Shilling (TZS)" }
  },
  {
    id: "TGO", numericId: "768", iso2: "TG", name: "Togo", officialName: "Togolese Republic",
    continent: "Africa", subregion: "Western Africa", capital: "Lome",
    coordinates: [0.8248, 8.6195], capitalCoordinates: [1.2228, 6.1375], flagEmoji: "🇹🇬",
    facts: { politicalRegime: "Parliamentary republic", leader: "Faure Gnassingbé", cuisine: "Ablo with sauce", currency: "West African CFA Franc (XOF)" }
  },
  {
    id: "TUN", numericId: "788", iso2: "TN", name: "Tunisia", officialName: "Republic of Tunisia",
    continent: "Africa", subregion: "Northern Africa", capital: "Tunis",
    coordinates: [9.5375, 33.8869], capitalCoordinates: [10.1815, 36.8065], flagEmoji: "🇹🇳",
    facts: { politicalRegime: "Presidential republic", leader: "Kais Saied", cuisine: "Couscous with fish", currency: "Tunisian Dinar (TND)" }
  },
  {
    id: "UGA", numericId: "800", iso2: "UG", name: "Uganda", officialName: "Republic of Uganda",
    continent: "Africa", subregion: "Eastern Africa", capital: "Kampala",
    coordinates: [32.2903, 1.3733], capitalCoordinates: [32.5825, 0.3476], flagEmoji: "🇺🇬",
    facts: { politicalRegime: "Presidential republic", leader: "Yoweri Museveni", cuisine: "Matooke", currency: "Ugandan Shilling (UGX)" }
  },
  {
    id: "ZMB", numericId: "894", iso2: "ZM", name: "Zambia", officialName: "Republic of Zambia",
    continent: "Africa", subregion: "Eastern Africa", capital: "Lusaka",
    coordinates: [27.8493, -13.1339], capitalCoordinates: [28.3228, -15.3875], flagEmoji: "🇿🇲",
    facts: { politicalRegime: "Presidential republic", leader: "Hakainde Hichilema", cuisine: "Nshima with Ifisashi", currency: "Zambian Kwacha (ZMW)" }
  },
  {
    id: "ZWE", numericId: "716", iso2: "ZW", name: "Zimbabwe", officialName: "Republic of Zimbabwe",
    continent: "Africa", subregion: "Eastern Africa", capital: "Harare",
    coordinates: [29.1549, -19.0154], capitalCoordinates: [31.0530, -17.8252], flagEmoji: "🇿🇼",
    facts: { politicalRegime: "Presidential republic", leader: "Emmerson Mnangagwa", cuisine: "Sadza with relish", currency: "Zimbabwe Gold (ZiG)" }
  },

  // =========================================================================
  // AMERICAS (35 Sovereign Countries)
  // =========================================================================
  {
    id: "ATG", numericId: "028", iso2: "AG", name: "Antigua and Barbuda", officialName: "Antigua and Barbuda",
    continent: "Americas", subregion: "Caribbean", capital: "St. John's",
    coordinates: [-61.8468, 17.0747], capitalCoordinates: [-61.8456, 17.1274], flagEmoji: "🇦🇬",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Gaston Browne", cuisine: "Pepperpot & Fungee", currency: "East Caribbean Dollar (XCD)" }
  },
  {
    id: "ARG", numericId: "032", iso2: "AR", name: "Argentina", officialName: "Argentine Republic",
    continent: "Americas", subregion: "South America", capital: "Buenos Aires",
    coordinates: [-63.6167, -38.4161], capitalCoordinates: [-58.3816, -34.6037], flagEmoji: "🇦🇷",
    facts: { politicalRegime: "Federal presidential republic", leader: "Javier Milei", cuisine: "Asado & Empanadas", currency: "Argentine Peso (ARS)" }
  },
  {
    id: "BHS", numericId: "044", iso2: "BS", name: "Bahamas", officialName: "Commonwealth of the Bahamas",
    continent: "Americas", subregion: "Caribbean", capital: "Nassau",
    coordinates: [-77.3963, 25.0343], capitalCoordinates: [-77.3504, 25.0443], flagEmoji: "🇧🇸",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Philip Davis", cuisine: "Conch Salad", currency: "Bahamian Dollar (BSD)" }
  },
  {
    id: "BRB", numericId: "052", iso2: "BB", name: "Barbados", officialName: "Barbados",
    continent: "Americas", subregion: "Caribbean", capital: "Bridgetown",
    coordinates: [-59.5432, 13.1939], capitalCoordinates: [-59.6132, 13.0969], flagEmoji: "🇧🇧",
    facts: { politicalRegime: "Parliamentary republic", leader: "Mia Mottley", cuisine: "Cou-Cou and Flying Fish", currency: "Barbadian Dollar (BBD)" }
  },
  {
    id: "BLZ", numericId: "084", iso2: "BZ", name: "Belize", officialName: "Belize",
    continent: "Americas", subregion: "Central America", capital: "Belmopan",
    coordinates: [-88.4976, 17.1899], capitalCoordinates: [-88.7667, 17.2514], flagEmoji: "🇧🇿",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Johnny Briceño", cuisine: "Boil Up", currency: "Belize Dollar (BZD)" }
  },
  {
    id: "BOL", numericId: "068", iso2: "BO", name: "Bolivia", officialName: "Plurinational State of Bolivia",
    continent: "Americas", subregion: "South America", capital: "Sucre",
    coordinates: [-63.5887, -16.2902], capitalCoordinates: [-65.2627, -19.0196], flagEmoji: "🇧🇴",
    facts: { politicalRegime: "Presidential republic", leader: "Luis Arce", cuisine: "Salteñas", currency: "Bolivian Boliviano (BOB)" }
  },
  {
    id: "BRA", numericId: "076", iso2: "BR", name: "Brazil", officialName: "Federative Republic of Brazil",
    continent: "Americas", subregion: "South America", capital: "Brasilia",
    coordinates: [-51.9253, -14.2350], capitalCoordinates: [-47.8825, -15.7942], flagEmoji: "🇧🇷",
    facts: { politicalRegime: "Federal presidential republic", leader: "Luiz Inácio Lula da Silva", cuisine: "Feijoada", currency: "Brazilian Real (BRL)" }
  },
  {
    id: "CAN", numericId: "124", iso2: "CA", name: "Canada", officialName: "Canada",
    continent: "Americas", subregion: "Northern America", capital: "Ottawa",
    coordinates: [-106.3468, 56.1304], capitalCoordinates: [-75.6972, 45.4215], flagEmoji: "🇨🇦",
    facts: { politicalRegime: "Federal parliamentary constitutional monarchy", leader: "Justin Trudeau", cuisine: "Poutine", currency: "Canadian Dollar (CAD)" }
  },
  {
    id: "CHL", numericId: "152", iso2: "CL", name: "Chile", officialName: "Republic of Chile",
    continent: "Americas", subregion: "South America", capital: "Santiago",
    coordinates: [-71.5430, -35.6751], capitalCoordinates: [-70.6693, -33.4489], flagEmoji: "🇨🇱",
    facts: { politicalRegime: "Presidential republic", leader: "Gabriel Boric", cuisine: "Pastel de Choclo", currency: "Chilean Peso (CLP)" }
  },
  {
    id: "COL", numericId: "170", iso2: "CO", name: "Colombia", officialName: "Republic of Colombia",
    continent: "Americas", subregion: "South America", capital: "Bogota",
    coordinates: [-74.2973, 4.5709], capitalCoordinates: [-74.0721, 4.7110], flagEmoji: "🇨🇴",
    facts: { politicalRegime: "Presidential republic", leader: "Gustavo Petro", cuisine: "Bandeja Paisa", currency: "Colombian Peso (COP)" }
  },
  {
    id: "CRI", numericId: "188", iso2: "CR", name: "Costa Rica", officialName: "Republic of Costa Rica",
    continent: "Americas", subregion: "Central America", capital: "San Jose",
    coordinates: [-83.7534, 9.7489], capitalCoordinates: [-84.0907, 9.9281], flagEmoji: "🇨🇷",
    facts: { politicalRegime: "Presidential republic", leader: "Rodrigo Chaves Robles", cuisine: "Gallo Pinto", currency: "Costa Rican Colón (CRC)" }
  },
  {
    id: "CUB", numericId: "192", iso2: "CU", name: "Cuba", officialName: "Republic of Cuba",
    continent: "Americas", subregion: "Caribbean", capital: "Havana",
    coordinates: [-77.7812, 21.5218], capitalCoordinates: [-82.3666, 23.1136], flagEmoji: "🇨🇺",
    facts: { politicalRegime: "Socialist one-party state", leader: "Miguel Díaz-Canel", cuisine: "Ropa Vieja", currency: "Cuban Peso (CUP)" }
  },
  {
    id: "DMA", numericId: "212", iso2: "DM", name: "Dominica", officialName: "Commonwealth of Dominica",
    continent: "Americas", subregion: "Caribbean", capital: "Roseau",
    coordinates: [-61.3710, 15.4150], capitalCoordinates: [-61.3870, 15.3017], flagEmoji: "🇩🇲",
    facts: { politicalRegime: "Parliamentary republic", leader: "Roosevelt Skerrit", cuisine: "Callaloo Soup", currency: "East Caribbean Dollar (XCD)" }
  },
  {
    id: "DOM", numericId: "214", iso2: "DO", name: "Dominican Republic", officialName: "Dominican Republic",
    continent: "Americas", subregion: "Caribbean", capital: "Santo Domingo",
    coordinates: [-70.1627, 18.7357], capitalCoordinates: [-69.9312, 18.4861], flagEmoji: "🇩🇴",
    facts: { politicalRegime: "Presidential republic", leader: "Luis Abinader", cuisine: "La Bandera", currency: "Dominican Peso (DOP)" }
  },
  {
    id: "ECU", numericId: "218", iso2: "EC", name: "Ecuador", officialName: "Republic of Ecuador",
    continent: "Americas", subregion: "South America", capital: "Quito",
    coordinates: [-78.1834, -1.8312], capitalCoordinates: [-78.4678, -0.1807], flagEmoji: "🇪🇨",
    facts: { politicalRegime: "Presidential republic", leader: "Daniel Noboa", cuisine: "Encebollado", currency: "United States Dollar (USD)" }
  },
  {
    id: "SLV", numericId: "222", iso2: "SV", name: "El Salvador", officialName: "Republic of El Salvador",
    continent: "Americas", subregion: "Central America", capital: "San Salvador",
    coordinates: [-88.8965, 13.7942], capitalCoordinates: [-89.2182, 13.6929], flagEmoji: "🇸🇻",
    facts: { politicalRegime: "Presidential republic", leader: "Nayib Bukele", cuisine: "Pupusas", currency: "United States Dollar (USD)" }
  },
  {
    id: "GRD", numericId: "308", iso2: "GD", name: "Grenada", officialName: "Grenada",
    continent: "Americas", subregion: "Caribbean", capital: "St. George's",
    coordinates: [-61.6042, 12.1165], capitalCoordinates: [-61.7457, 12.0561], flagEmoji: "🇬🇩",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Dickon Mitchell", cuisine: "Oil Down", currency: "East Caribbean Dollar (XCD)" }
  },
  {
    id: "GTM", numericId: "320", iso2: "GT", name: "Guatemala", officialName: "Republic of Guatemala",
    continent: "Americas", subregion: "Central America", capital: "Guatemala City",
    coordinates: [-90.2308, 15.7835], capitalCoordinates: [-90.5069, 14.6349], flagEmoji: "🇬🇹",
    facts: { politicalRegime: "Presidential republic", leader: "Bernardo Arévalo", cuisine: "Pepián", currency: "Guatemalan Quetzal (GTQ)" }
  },
  {
    id: "GUY", numericId: "328", iso2: "GY", name: "Guyana", officialName: "Co-operative Republic of Guyana",
    continent: "Americas", subregion: "South America", capital: "Georgetown",
    coordinates: [-58.9302, 4.8604], capitalCoordinates: [-58.1553, 6.8013], flagEmoji: "🇬🇾",
    facts: { politicalRegime: "Presidential republic", leader: "Irfaan Ali", cuisine: "Pepperpot", currency: "Guyanese Dollar (GYD)" }
  },
  {
    id: "HTI", numericId: "332", iso2: "HT", name: "Haiti", officialName: "Republic of Haiti",
    continent: "Americas", subregion: "Caribbean", capital: "Port-au-Prince",
    coordinates: [-72.2852, 18.9712], capitalCoordinates: [-72.3333, 18.5392], flagEmoji: "🇭🇹",
    facts: { politicalRegime: "Semi-presidential republic", leader: "Transitional Council", cuisine: "Soup Joumou", currency: "Haitian Gourde (HTG)" }
  },
  {
    id: "HND", numericId: "340", iso2: "HN", name: "Honduras", officialName: "Republic of Honduras",
    continent: "Americas", subregion: "Central America", capital: "Tegucigalpa",
    coordinates: [-86.2419, 15.2000], capitalCoordinates: [-87.2068, 14.0723], flagEmoji: "🇭🇳",
    facts: { politicalRegime: "Presidential republic", leader: "Xiomara Castro", cuisine: "Plato Típico & Baleadas", currency: "Honduran Lempira (HNL)" }
  },
  {
    id: "JAM", numericId: "388", iso2: "JM", name: "Jamaica", officialName: "Jamaica",
    continent: "Americas", subregion: "Caribbean", capital: "Kingston",
    coordinates: [-77.2975, 18.1096], capitalCoordinates: [-76.7936, 17.9714], flagEmoji: "🇯🇲",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Andrew Holness", cuisine: "Ackee and Saltfish", currency: "Jamaican Dollar (JMD)" }
  },
  {
    id: "MEX", numericId: "484", iso2: "MX", name: "Mexico", officialName: "United Mexican States",
    continent: "Americas", subregion: "Northern America", capital: "Mexico City",
    coordinates: [-102.5528, 23.6345], capitalCoordinates: [-99.1332, 19.4326], flagEmoji: "🇲🇽",
    facts: { politicalRegime: "Federal presidential republic", leader: "Claudia Sheinbaum", cuisine: "Mole Poblano & Tacos", currency: "Mexican Peso (MXN)" }
  },
  {
    id: "NIC", numericId: "558", iso2: "NI", name: "Nicaragua", officialName: "Republic of Nicaragua",
    continent: "Americas", subregion: "Central America", capital: "Managua",
    coordinates: [-85.2072, 12.8654], capitalCoordinates: [-86.2362, 12.1150], flagEmoji: "🇳🇮",
    facts: { politicalRegime: "Presidential republic", leader: "Daniel Ortega", cuisine: "Gallo Pinto", currency: "Nicaraguan Córdoba (NIO)" }
  },
  {
    id: "PAN", numericId: "591", iso2: "PA", name: "Panama", officialName: "Republic of Panama",
    continent: "Americas", subregion: "Central America", capital: "Panama City",
    coordinates: [-80.7821, 8.5380], capitalCoordinates: [-79.5167, 8.9833], flagEmoji: "🇵🇦",
    facts: { politicalRegime: "Presidential republic", leader: "José Raúl Mulino", cuisine: "Sancocho de Gallina", currency: "Panamanian Balboa / USD" }
  },
  {
    id: "PRY", numericId: "600", iso2: "PY", name: "Paraguay", officialName: "Republic of Paraguay",
    continent: "Americas", subregion: "South America", capital: "Asuncion",
    coordinates: [-58.4438, -23.4425], capitalCoordinates: [-57.5759, -25.2637], flagEmoji: "🇵🇾",
    facts: { politicalRegime: "Presidential republic", leader: "Santiago Peña", cuisine: "Sopa Paraguaya", currency: "Paraguayan Guaraní (PYG)" }
  },
  {
    id: "PER", numericId: "604", iso2: "PE", name: "Peru", officialName: "Republic of Peru",
    continent: "Americas", subregion: "South America", capital: "Lima",
    coordinates: [-75.0152, -9.1900], capitalCoordinates: [-77.0428, -12.0464], flagEmoji: "🇵🇪",
    facts: { politicalRegime: "Presidential republic", leader: "Dina Boluarte", cuisine: "Ceviche", currency: "Peruvian Sol (PEN)" }
  },
  {
    id: "KNA", numericId: "659", iso2: "KN", name: "Saint Kitts and Nevis", officialName: "Federation of Saint Christopher and Nevis",
    continent: "Americas", subregion: "Caribbean", capital: "Basseterre",
    coordinates: [-62.7830, 17.3578], capitalCoordinates: [-62.7261, 17.2948], flagEmoji: "🇰🇳",
    facts: { politicalRegime: "Federal parliamentary constitutional monarchy", leader: "Terrance Drew", cuisine: "Saltfish and Dumplings", currency: "East Caribbean Dollar (XCD)" }
  },
  {
    id: "LCA", numericId: "662", iso2: "LC", name: "Saint Lucia", officialName: "Saint Lucia",
    continent: "Americas", subregion: "Caribbean", capital: "Castries",
    coordinates: [-60.9789, 13.9094], capitalCoordinates: [-60.9875, 14.0101], flagEmoji: "🇱🇨",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Philip J. Pierre", cuisine: "Green Fig and Saltfish", currency: "East Caribbean Dollar (XCD)" }
  },
  {
    id: "VCT", numericId: "670", iso2: "VC", name: "Saint Vincent and the Grenadines", officialName: "Saint Vincent and the Grenadines",
    continent: "Americas", subregion: "Caribbean", capital: "Kingstown",
    coordinates: [-61.2872, 13.2528], capitalCoordinates: [-61.2248, 13.1587], flagEmoji: "🇻🇨",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Ralph Gonsalves", cuisine: "Roasted Breadfruit and Fried Jackfish", currency: "East Caribbean Dollar (XCD)" }
  },
  {
    id: "SUR", numericId: "740", iso2: "SR", name: "Suriname", officialName: "Republic of Suriname",
    continent: "Americas", subregion: "South America", capital: "Paramaribo",
    coordinates: [-56.0278, 3.9193], capitalCoordinates: [-55.2038, 5.8520], flagEmoji: "🇸🇷",
    facts: { politicalRegime: "Presidential republic", leader: "Chan Santokhi", cuisine: "Pom", currency: "Surinamese Dollar (SRD)" }
  },
  {
    id: "TTO", numericId: "780", iso2: "TT", name: "Trinidad and Tobago", officialName: "Republic of Trinidad and Tobago",
    continent: "Americas", subregion: "Caribbean", capital: "Port of Spain",
    coordinates: [-61.2225, 10.6918], capitalCoordinates: [-61.5189, 10.6549], flagEmoji: "🇹🇹",
    facts: { politicalRegime: "Parliamentary republic", leader: "Keith Rowley", cuisine: "Crab and Callaloo", currency: "Trinidad and Tobago Dollar (TTD)" }
  },
  {
    id: "USA", numericId: "840", iso2: "US", name: "United States", officialName: "United States of America",
    continent: "Americas", subregion: "Northern America", capital: "Washington, D.C.",
    coordinates: [-95.7129, 37.0902], capitalCoordinates: [-77.0369, 38.9072], flagEmoji: "🇺🇸",
    facts: { politicalRegime: "Federal presidential republic", leader: "Joe Biden", cuisine: "Apple Pie & Barbecue", currency: "United States Dollar (USD)" }
  },
  {
    id: "URY", numericId: "858", iso2: "UY", name: "Uruguay", officialName: "Oriental Republic of Uruguay",
    continent: "Americas", subregion: "South America", capital: "Montevideo",
    coordinates: [-55.7658, -32.5228], capitalCoordinates: [-56.1645, -34.9011], flagEmoji: "🇺🇾",
    facts: { politicalRegime: "Presidential republic", leader: "Luis Lacalle Pou", cuisine: "Chivito", currency: "Uruguayan Peso (UYU)" }
  },
  {
    id: "VEN", numericId: "862", iso2: "VE", name: "Venezuela", officialName: "Bolivarian Republic of Venezuela",
    continent: "Americas", subregion: "South America", capital: "Caracas",
    coordinates: [-66.5897, 6.4238], capitalCoordinates: [-66.9036, 10.4806], flagEmoji: "🇻🇪",
    facts: { politicalRegime: "Presidential republic", leader: "Nicolás Maduro", cuisine: "Pabellón Criollo", currency: "Venezuelan Bolívar (VES)" }
  },

  // =========================================================================
  // OCEANIA (14 Sovereign Countries)
  // =========================================================================
  {
    id: "AUS", numericId: "036", iso2: "AU", name: "Australia", officialName: "Commonwealth of Australia",
    continent: "Oceania", subregion: "Australia and New Zealand", capital: "Canberra",
    coordinates: [133.7751, -25.2744], capitalCoordinates: [149.1300, -35.2809], flagEmoji: "🇦🇺",
    facts: { politicalRegime: "Federal parliamentary constitutional monarchy", leader: "Anthony Albanese", cuisine: "Meat Pie & Vegemite", currency: "Australian Dollar (AUD)" }
  },
  {
    id: "FJI", numericId: "242", iso2: "FJ", name: "Fiji", officialName: "Republic of Fiji",
    continent: "Oceania", subregion: "Melanesia", capital: "Suva",
    coordinates: [178.0650, -17.7134], capitalCoordinates: [178.4419, -18.1416], flagEmoji: "🇫🇯",
    facts: { politicalRegime: "Parliamentary republic", leader: "Sitiveni Rabuka", cuisine: "Kokoda", currency: "Fijian Dollar (FJD)" }
  },
  {
    id: "KIR", numericId: "296", iso2: "KI", name: "Kiribati", officialName: "Republic of Kiribati",
    continent: "Oceania", subregion: "Micronesia", capital: "South Tarawa",
    coordinates: [-157.3630, 1.8709], capitalCoordinates: [172.9770, 1.3283], flagEmoji: "🇰🇮",
    facts: { politicalRegime: "Parliamentary republic", leader: "Taneti Maamau", cuisine: "Palusami", currency: "Australian Dollar (AUD)" }
  },
  {
    id: "MHL", numericId: "584", iso2: "MH", name: "Marshall Islands", officialName: "Republic of the Marshall Islands",
    continent: "Oceania", subregion: "Micronesia", capital: "Majuro",
    coordinates: [171.1845, 7.1315], capitalCoordinates: [171.3803, 7.1065], flagEmoji: "🇲🇭",
    facts: { politicalRegime: "Parliamentary republic", leader: "Hilda Heine", cuisine: "Barramundi & Breadfruit", currency: "United States Dollar (USD)" }
  },
  {
    id: "FSM", numericId: "583", iso2: "FM", name: "Micronesia", officialName: "Federated States of Micronesia",
    continent: "Oceania", subregion: "Micronesia", capital: "Palikir",
    coordinates: [150.5508, 7.4256], capitalCoordinates: [158.1611, 6.9178], flagEmoji: "🇫🇲",
    facts: { politicalRegime: "Federal presidential republic", leader: "Wesley Simina", cuisine: "Uhot (Breadfruit paste)", currency: "United States Dollar (USD)" }
  },
  {
    id: "NRU", numericId: "520", iso2: "NR", name: "Nauru", officialName: "Republic of Nauru",
    continent: "Oceania", subregion: "Micronesia", capital: "Yaren",
    coordinates: [166.9315, -0.5228], capitalCoordinates: [166.9167, -0.5472], flagEmoji: "🇳🇷",
    facts: { politicalRegime: "Parliamentary republic", leader: "David Adeang", cuisine: "Coconut Fish", currency: "Australian Dollar (AUD)" }
  },
  {
    id: "NZL", numericId: "554", iso2: "NZ", name: "New Zealand", officialName: "New Zealand",
    continent: "Oceania", subregion: "Australia and New Zealand", capital: "Wellington",
    coordinates: [174.8860, -40.9006], capitalCoordinates: [174.7762, -41.2865], flagEmoji: "🇳🇿",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Christopher Luxon", cuisine: "Hāngī & Pavlova", currency: "New Zealand Dollar (NZD)" }
  },
  {
    id: "PLW", numericId: "585", iso2: "PW", name: "Palau", officialName: "Republic of Palau",
    continent: "Oceania", subregion: "Micronesia", capital: "Ngerulmud",
    coordinates: [134.5825, 7.5150], capitalCoordinates: [134.6242, 7.5004], flagEmoji: "🇵🇼",
    facts: { politicalRegime: "Presidential republic", leader: "Surangel Whipps Jr.", cuisine: "Fruit Bat Soup & Taro", currency: "United States Dollar (USD)" }
  },
  {
    id: "PNG", numericId: "598", iso2: "PG", name: "Papua New Guinea", officialName: "Independent State of Papua New Guinea",
    continent: "Oceania", subregion: "Melanesia", capital: "Port Moresby",
    coordinates: [143.9555, -6.3150], capitalCoordinates: [147.1803, -9.4438], flagEmoji: "🇵🇬",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "James Marape", cuisine: "Mumu", currency: "Papua New Guinean Kina (PGK)" }
  },
  {
    id: "WSM", numericId: "882", iso2: "WS", name: "Samoa", officialName: "Independent State of Samoa",
    continent: "Oceania", subregion: "Polynesia", capital: "Apia",
    coordinates: [-172.1046, -13.7590], capitalCoordinates: [-171.7667, -13.8333], flagEmoji: "🇼🇸",
    facts: { politicalRegime: "Parliamentary republic", leader: "Fiamē Naomi Mataʻafa", cuisine: "Oka I'a (Raw fish in coconut)", currency: "Samoan Tālā (WST)" }
  },
  {
    id: "SLB", numericId: "090", iso2: "SB", name: "Solomon Islands", officialName: "Solomon Islands",
    continent: "Oceania", subregion: "Melanesia", capital: "Honiara",
    coordinates: [160.1562, -9.6457], capitalCoordinates: [159.9500, -9.4333], flagEmoji: "🇸🇧",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Jeremiah Manele", cuisine: "Poi & Cassava pudding", currency: "Solomon Islands Dollar (SBD)" }
  },
  {
    id: "TON", numericId: "776", iso2: "TO", name: "Tonga", officialName: "Kingdom of Tonga",
    continent: "Oceania", subregion: "Polynesia", capital: "Nuku'alofa",
    coordinates: [-175.1982, -21.1789], capitalCoordinates: [-175.2000, -21.1333], flagEmoji: "🇹🇴",
    facts: { politicalRegime: "Constitutional monarchy", leader: "Siaosi Sovaleni", cuisine: "Lu Pulu", currency: "Tongan Paʻanga (TOP)" }
  },
  {
    id: "TUV", numericId: "798", iso2: "TV", name: "Tuvalu", officialName: "Tuvalu",
    continent: "Oceania", subregion: "Polynesia", capital: "Funafuti",
    coordinates: [177.6493, -7.1095], capitalCoordinates: [179.1942, -8.5211], flagEmoji: "🇹🇻",
    facts: { politicalRegime: "Parliamentary constitutional monarchy", leader: "Feleti Teo", cuisine: "Pulaka & Coconut soup", currency: "Tuvaluan Dollar / AUD" }
  },
  {
    id: "VUT", numericId: "548", iso2: "VU", name: "Vanuatu", officialName: "Republic of Vanuatu",
    continent: "Oceania", subregion: "Melanesia", capital: "Port Vila",
    coordinates: [166.9592, -15.3767], capitalCoordinates: [168.3219, -17.7404], flagEmoji: "🇻🇺",
    facts: { politicalRegime: "Parliamentary republic", leader: "Charlot Salwai", cuisine: "Laplap", currency: "Vanuatu Vatu (VUV)" }
  }
];

// Write to src/assets/data/countries.ts
const fileHeader = `import { Country } from '../../core/types';

/**
 * Complete, verified world dataset of sovereign states and observer territories.
 * Includes geographic coordinates, capitals, flags, and extensible starter facts
 * for political regimes, leaders, cuisines, and currencies.
 */
export const COUNTRIES: Country[] = `;

const content = fileHeader + JSON.stringify(allCountries, null, 2) + ';\n\n' +
  'export const COUNTRIES_BY_ID = new Map<string, Country>(\n' +
  '  COUNTRIES.map((c) => [c.id, c])\n' +
  ');\n\n' +
  'export const COUNTRIES_BY_NUMERIC = new Map<string, Country>(\n' +
  '  COUNTRIES.map((c) => [c.numericId, c])\n' +
  ');\n';

fs.writeFileSync('src/assets/data/countries.ts', content, 'utf8');
console.log(`Successfully generated src/assets/data/countries.ts with ${allCountries.length} countries!`);
