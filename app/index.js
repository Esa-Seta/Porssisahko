import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const API_URL = 'https://api.porssisahko.net/v2/latest-prices.json';
const GREEN_COLOR = '#2e7d32';
const RED_COLOR = '#d32f2f';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rawPrices, setRawPrices] = useState([]);
  const [currentPriceItem, setCurrentPriceItem] = useState(null);
  
  // KÄYTTÄJÄN ASETUKSET (Uudet oletusarvot)
  const [margin, setMargin] = useState("0.5");
  const [transferDay, setTransferDay] = useState("5.11");
  const [transferNight, setTransferNight] = useState("3.12");
  const [fixedPrice, setFixedPrice] = useState("12.0");
  
  const appState = useRef(AppState.currentState);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const fetchPrices = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(API_URL, {
        headers: { 'User-Agent': 'PorssisahkoGraafiApp/1.5 (Mac; iOS)' }
      });

      if (!response.ok) throw new Error(`Palvelinvirhe: ${response.status}`);
      const json = await response.json();
      if (!json.prices || json.prices.length === 0) throw new Error("Tyhjä data");

      const now = new Date();
      const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

      const filtered = json.prices
        .filter(item => new Date(item.startDate) >= currentHourStart)
        .reverse();

      setRawPrices(filtered);

      const currentItem = json.prices.find(item => {
        const d = new Date(item.startDate);
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate() &&
               d.getHours() === now.getHours();
      });
      
      setCurrentPriceItem(currentItem ? currentItem : json.prices[0]);

    } catch (error) {
      console.log("Virhe:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchPrices();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // --- HINTOJEN LASKENTALOGIIKKA ---
  const calculateFinalPrice = (basePrice, dateString) => {
    const date = new Date(dateString);
    const hour = date.getHours();
    
    const numMargin = parseFloat(margin.replace(',', '.')) || 0;
    const numTransferDay = parseFloat(transferDay.replace(',', '.')) || 0;
    const numTransferNight = parseFloat(transferNight.replace(',', '.')) || 0;

    const isDayTime = hour >= 7 && hour < 22;
    const transferCost = isDayTime ? numTransferDay : numTransferNight;

    return basePrice + numMargin + transferCost;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN_COLOR} />
      </View>
    );
  }

  // ALIN JA YLIN KOKONAISHINTA (Pörssisähkö + Marginaali + Siirto)
  const finalPricesList = rawPrices.map(item => calculateFinalPrice(item.price, item.startDate));
  const minPrice = finalPricesList.length > 0 ? Math.min(...finalPricesList) : 0;
  const maxPrice = finalPricesList.length > 0 ? Math.max(...finalPricesList) : 0;

  // VERTAILU KIINTEÄÄN SOPIMUKSEEN
  const displayCurrentPrice = currentPriceItem ? calculateFinalPrice(currentPriceItem.price, currentPriceItem.startDate) : null;
  const isCurrentPriceHigh = currentPriceItem && currentPriceItem.price >= 10;
  
  const currentHour = currentPriceItem ? new Date(currentPriceItem.startDate).getHours() : new Date().getHours();
  const numTransferDay = parseFloat(transferDay.replace(',', '.')) || 0;
  const numTransferNight = parseFloat(transferNight.replace(',', '.')) || 0;
  const currentTransfer = (currentHour >= 7 && currentHour < 22) ? numTransferDay : numTransferNight;

  const numFixed = parseFloat(fixedPrice.replace(',', '.')) || 0;
  
  const totalPorssi = displayCurrentPrice !== null ? displayCurrentPrice : 0;
  const totalKiintea = numFixed + currentTransfer;
  
  const priceDiff = totalPorssi - totalKiintea;

  // DATAN JA LABELIEN MUOTOILU
  const totalItems = rawPrices.length;
  const labelInterval = isLandscape ? 2 : (totalItems > 20 ? 4 : 2);

  const labels = rawPrices.map((item, index) => {
    const itemDate = new Date(item.startDate);
    const hours = itemDate.getHours();
    const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;

    if (hours === 0 && index > 0) return `${itemDate.getDate()}.${itemDate.getMonth() + 1}.`;
    if (index % labelInterval === 0 || index === totalItems - 1) return formattedHours;
    return '';
  });

  const chartData = finalPricesList.length > 0 ? { labels, datasets: [{ data: finalPricesList }] } : null;

  const computedChartWidth = isLandscape ? width - 40 : width - 32;
  const computedChartHeight = isLandscape ? height - 170 : 250;

  return (
    <ScrollView 
      contentContainerStyle={[styles.container, isLandscape && styles.containerLandscape]}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.headerContainer, isLandscape && styles.headerContainerLandscape]}>
        <Text style={styles.title}>Pörssisähkö Nyt</Text>
        
        <View style={styles.priceRow}>
          
          {/* VASEN: Alin & Ylin pörssisähkön kokonaishinta */}
          {isLandscape && (
            <View style={styles.sideContainerLeft}>
              <Text style={styles.sideLabel}>Alin: <Text style={styles.sideValue}>{minPrice.toFixed(2)}</Text></Text>
              <Text style={styles.sideLabel}>Ylin: <Text style={styles.sideValue}>{maxPrice.toFixed(2)}</Text></Text>
            </View>
          )}

          {/* KESKELLÄ: Kuluva Pörssisähkö -kokonaishinta */}
          {displayCurrentPrice !== null && (
            <View style={styles.mainPriceContainer}>
              <Text style={[
                styles.price, 
                { color: isCurrentPriceHigh ? RED_COLOR : GREEN_COLOR }, 
                isLandscape && styles.priceLandscape
              ]}>
                {displayCurrentPrice.toFixed(2)} c/kWh
              </Text>
            </View>
          )}

          {/* OIKEALLA: Erotus kiinteään sopimukseen */}
          {displayCurrentPrice !== null && (
            <View style={styles.sideContainerRight}>
              <Text style={[
                styles.diffValue, 
                { color: priceDiff > 0 ? RED_COLOR : GREEN_COLOR },
                isLandscape && styles.diffValueLandscape
              ]}>
                {priceDiff > 0 ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)} c
              </Text>
              <Text style={styles.diffLabel}>
                {priceDiff > 0 ? 'Kiinteää kalliimpi' : 'Kiinteää halvempi'}
              </Text>
            </View>
          )}

        </View>
        
        <TouchableOpacity 
          style={[styles.button, refreshing && styles.buttonDisabled, isCurrentPriceHigh && styles.buttonRed]} 
          onPress={() => fetchPrices(true)}
          disabled={refreshing}
        >
          <Text style={styles.buttonText}>
            {refreshing ? 'Päivitetään...' : 'Päivitä'}
          </Text>
        </TouchableOpacity>
      </View>

      {chartData ? (
        <View style={styles.chartContainer}>
          <Text style={styles.subtitle}>Tulevat tunnit (snt/kWh)</Text>
          <LineChart
            data={chartData}
            width={computedChartWidth}
            height={computedChartHeight}
            fromZero={true}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 1,
              color: () => 'rgba(0, 0, 0, 0.2)',
              labelColor: () => 'rgba(0, 0, 0, 0.8)',
              propsForDots: {
                r: '3',
                strokeWidth: '0',
              },
              getDotColor: (dataPoint, index) => {
                const rawPrice = rawPrices[index].price;
                return rawPrice >= 10 ? RED_COLOR : GREEN_COLOR;
              }
            }}
            bezier
            style={styles.chart}
          />
        </View>
      ) : (
        <Text style={styles.errorText}>Hintoja ei voitu ladata.</Text>
      )}

      {/* ASETUKSET LISÄKULUILLE JA KIINTEÄLLE SOPIMUKSELLE */}
      <View style={styles.settingsContainer}>
        <Text style={styles.settingsTitle}>Omat lisäkulut & Vertailuhinta (snt/kWh)</Text>
        
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Marginaali (komissio):</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="decimal-pad" 
            value={margin} 
            onChangeText={setMargin}
            selectTextOnFocus
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Siirtohinta (päivä 07-22):</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="decimal-pad" 
            value={transferDay} 
            onChangeText={setTransferDay}
            selectTextOnFocus
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Siirtohinta (yö 22-07):</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="decimal-pad" 
            value={transferNight} 
            onChangeText={setTransferNight}
            selectTextOnFocus
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Kiinteä sopimus (energia):</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="decimal-pad" 
            value={fixedPrice} 
            onChangeText={setFixedPrice}
            selectTextOnFocus
          />
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 16,
    paddingTop: 50,
    paddingBottom: 40,
  },
  containerLandscape: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    paddingTop: 15,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  headerContainerLandscape: {
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 4,
  },
  mainPriceContainer: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  price: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  priceLandscape: {
    fontSize: 26,
  },
  sideContainerLeft: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 90,
  },
  sideLabel: {
    fontSize: 12,
    color: '#666',
  },
  sideValue: {
    fontWeight: 'bold',
    color: '#333',
  },
  sideContainerRight: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 90,
  },
  diffValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  diffValueLandscape: {
    fontSize: 16,
  },
  diffLabel: {
    fontSize: 11,
    color: '#666',
  },
  button: {
    backgroundColor: GREEN_COLOR,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 4,
  },
  buttonRed: {
    backgroundColor: RED_COLOR,
  },
  buttonDisabled: {
    backgroundColor: '#aaa',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  chartContainer: {
    alignItems: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  chart: {
    marginVertical: 4,
    borderRadius: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  settingsContainer: {
    width: '100%',
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 80,
    textAlign: 'right',
    fontSize: 16,
  },
});