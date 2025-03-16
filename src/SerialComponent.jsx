import { useEffect, useState } from 'react';

const usePolyfill = new URLSearchParams(window.location.search).has('polyfill');

const WeightScale = () => {
  const [port, setPort] = useState(null);
  const [weight, setWeight] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let reader = null;

  const isOldMachine = (info) =>
    info?.usbProductId === 9123 && info?.usbVendorId === 1659;

  const getSerial = () =>
    usePolyfill ? require('web-serial-polyfill').serial : navigator.serial;

  const requestPort = async () => {
    try {
      const serial = getSerial();
      const selectedPort = await serial.requestPort();
      setPort(selectedPort);
      return selectedPort;
    } catch (error) {
      console.error('Error selecting port:', error);
    }
  };

  const connect = async () => {
    if (port) await disconnect(); // Ensure port is closed before opening a new one

    const selectedPort = await requestPort();
    if (!selectedPort) return;

    const portInfo = selectedPort.getInfo();
    console.log(portInfo, 'portInfo');
    const baudRate = isOldMachine(portInfo) ? 1200 : 9600;
    const serialConfig = {
      baudRate,
      dataBits: 7,
      stopBits: 1,
      parity: 'even',
      flowControl: 'none',
    };

    try {
      await selectedPort.open(serialConfig);
      setIsConnected(true);
      console.log(`Connected to port with baudRate ${baudRate}`);
      readData(selectedPort);
    } catch (error) {
      console.error('Error opening port:', error);
    }
  };

  const readData = async (selectedPort) => {
    reader = selectedPort.readable.getReader();
    let weightValue = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const data = decoder.decode(value).replace(/[^ -~]+/g, ''); // Remove non-printable chars
        weightValue += data;

        if (isOldMachine(selectedPort.getInfo())) {
          const match = weightValue.match(/\+(\d{6})/); // Find 6-digit weight
          if (match) setWeight(Number(match[1]));
        } else {
          const numberValue = Number(data.replace(/[a-zA-Z]/g, '8')) / 1000;
          if (numberValue > 0) setWeight(numberValue.toFixed());
        }
      }
    } catch (error) {
      console.error('Error reading data:', error);
      disconnect();
    } finally {
      reader.releaseLock();
    }
  };

  const disconnect = async () => {
    try {
      if (reader) reader.releaseLock();
      if (port) await port.close();
      setIsConnected(false);
      setPort(null);
      console.log('Port closed');
    } catch (error) {
      console.error('Error closing port:', error);
    }
  };

  useEffect(() => {
    return () => disconnect(); // Close port when component unmounts
  }, []);

  return (
    <div className="weight-scale-container">
      <h2>Weight Scale Serial Reader</h2>
      <button onClick={connect} disabled={isConnected}>
        {isConnected ? 'Connected' : 'Connect'}
      </button>
      <button onClick={disconnect} disabled={!isConnected}>
        Disconnect
      </button>
      <p>Weight: {weight} kg</p>
    </div>
  );
};

export default WeightScale;
