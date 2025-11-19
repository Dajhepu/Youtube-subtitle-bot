import React, { useState, useEffect, useRef } from 'react';

// Natijalarni ko'rsatish uchun alohida komponent
function FlightResults({ results, airlinesInfo, airportsInfo, gatesInfo, searchId }) {
    const [redirectingUrl, setRedirectingUrl] = useState(null);

    const handleBuyClick = async (termsUrl) => {
        setRedirectingUrl(termsUrl);
        try {
            const response = await fetch('/api/redirect', { // O'zgartirildi
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ search_id: searchId, terms_url: termsUrl }),
            });
            const data = await response.json();
            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                alert('Xatolik: Yo\'naltirish havolasini olib bo\'lmadi.');
            }
        } catch (error) {
            console.error('Redirect error:', error);
            alert('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
        } finally {
            setRedirectingUrl(null);
        }
    };

    const proposalsData = results.find(r => r.proposals && r.proposals.length > 0);
    if (!proposalsData) {
        return <p>Parvozlar topilmadi.</p>;
    }
    const { proposals } = proposalsData;

    return (
        <div style={{ marginTop: '20px' }}>
            <h2>Qidiruv Natijalari</h2>
            {proposals.map((proposal) => {
                const gateId = Object.keys(proposal.terms)[0];
                const priceInfo = proposal.terms[gateId];
                const gateName = gatesInfo[gateId]?.label || `Agentlik #${gateId}`;
                const firstSegment = proposal.segment[0].flight[0];
                const marketingCarrier = airlinesInfo[firstSegment.marketing_carrier]?.name || firstSegment.marketing_carrier;
                const isRedirecting = redirectingUrl === priceInfo.url;

                return (
                    <div key={proposal.sign} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', margin: '10px 0', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p><strong>Aviakompaniya:</strong> {marketingCarrier}</p>
                            <p><strong>Narx:</strong> {priceInfo.price} {priceInfo.currency.toUpperCase()}</p>
                            <p><strong>Agentlik:</strong> {gateName}</p>
                            <p>Uchish: {firstSegment.departure} ({firstSegment.departure_date} {firstSegment.departure_time})</p>
                            <p>Qo'nish: {firstSegment.arrival} ({firstSegment.arrival_date} {firstSegment.arrival_time})</p>
                        </div>
                        <button
                            onClick={() => handleBuyClick(priceInfo.url)}
                            disabled={isRedirecting}
                            style={{ padding: '10px 20px', fontSize: '16px' }}
                        >
                            {isRedirecting ? 'Yo\'naltirilmoqda...' : 'Sotib olish'}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}


function App() {
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [departDate, setDepartDate] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pollingSearchId, setPollingSearchId] = useState(null);
    const [finalSearchId, setFinalSearchId] = useState(null);
    const [searchResults, setSearchResults] = useState(null);
    const intervalRef = useRef(null);

    const stopPolling = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    useEffect(() => {
        if (pollingSearchId) {
            const fetchResults = async () => {
                try {
                    const response = await fetch(`/api/results/${pollingSearchId}`); // O'zgartirildi
                    if (!response.ok) throw new Error('Natijalarni olishda xatolik');
                    const data = await response.json();
                    if (data && data.length > 0 && data.some(item => item.proposals && item.proposals.length > 0)) {
                        setSearchResults(data);
                        setLoading(false);
                        stopPolling();
                        setPollingSearchId(null);
                    }
                } catch (err) {
                    setError(err.message);
                    setLoading(false);
                    stopPolling();
                    setPollingSearchId(null);
                }
            };
            intervalRef.current = setInterval(fetchResults, 5000);
            fetchResults();
        }
        return () => stopPolling();
    }, [pollingSearchId]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setSearchResults(null);
        setFinalSearchId(null);
        stopPolling();

        try {
            const response = await fetch('/api/search', { // O'zgartirildi
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin, destination, depart_date: departDate, return_date: returnDate }),
            });
            const data = await response.json();
            if (response.ok && data.search_id) {
                setPollingSearchId(data.search_id);
                setFinalSearchId(data.search_id);
            } else {
                throw new Error(data.details || data.error || 'Qidiruv ID olinmadi');
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const airlinesInfo = searchResults?.find(r => r.airlines)?.airlines || {};
    const airportsInfo = searchResults?.find(r => r.airports)?.airports || {};
    const gatesInfo = searchResults?.find(r => r.gates_info)?.gates_info || {};

    return (
        <div>
            <header><h1>Aviachiptalarni Qidirish</h1></header>
            <main>
                <form onSubmit={handleSubmit}>
                    <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Qayerdan (masalan, TAS)" required />
                    <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Qayerga (masalan, DXB)" required />
                    <input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} required />
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
                    <button type="submit" disabled={loading}>{loading ? 'Qidirilmoqda...' : 'Qidirish'}</button>
                </form>

                {error && <p style={{ color: 'red' }}>Xatolik: {error}</p>}

                {searchResults && (
                    <FlightResults
                        results={searchResults}
                        airlinesInfo={airlinesInfo}
                        airportsInfo={airportsInfo}
                        gatesInfo={gatesInfo}
                        searchId={finalSearchId}
                    />
                )}
            </main>
        </div>
    );
}

export default App;
