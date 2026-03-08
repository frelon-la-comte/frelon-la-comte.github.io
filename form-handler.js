const formHandler = (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);

    fetch('https://script.google.com/macros/s/AKfycbynDOHoTx4ppTpGSZVXm1jRVDsaZ9-fbTdE8LiSTWX7jfmIU8JDhUbedMrayatO3CnP/exec', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
};

export default formHandler;