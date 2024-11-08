let socket = io.connect("http://localhost:5000", {
    transports: ['websocket']
});

const garmentMeasurements = {
    "tshirt": ["Chest Width", "Arm Hole", "Length"],
    "shirt": ["Chest Width", "Shoulder", "Length", "Sleeve Length"],
    "trousers": ["Waist", "Inseam", "Outseam", "Leg Opening"]
};

let selectedGarment = "";
let measurementsRecorded = {};
let isRecording = false;
let currentMeasurementIndex = 0;

function selectGarment(garment) {
    selectedGarment = garment;
    document.getElementById("garment-name").innerText = garment.charAt(0).toUpperCase() + garment.slice(1);
    const measurements = garmentMeasurements[garment];
    const listElement = document.getElementById("measurement-list");

    listElement.innerHTML = measurements.map((m, index) => `<li id="measurement-${index}">${m}: <span>-</span></li>`).join("");
    measurementsRecorded = {};
    currentMeasurementIndex = 0;
    highlightCurrentMeasurement();
}

function highlightCurrentMeasurement() {
    document.querySelectorAll('#measurement-list li').forEach((item, index) => {
        item.classList.toggle('active', index === currentMeasurementIndex);
    });
}

function startRecording() {
    if (isRecording) {
        updateStatusMessage("Recording is already in progress.");
        return;
    }
    isRecording = true;
    fetch("/start", { method: "POST" })
        .then(response => response.json())
        .then(data => updateStatusMessage("Recording started. Say 'next' to move to the next measurement or 'previous' to go back."))
        .catch(error => console.error(error));
}

function stopRecording() {
    if (!isRecording) {
        updateStatusMessage("No recording in progress.");
        return;
    }
    isRecording = false;
    fetch("/stop", { method: "POST" })
        .then(response => response.json())
        .then(data => {
            updateTable();
            updateStatusMessage("Recording stopped.");
        })
        .catch(error => console.error(error));
}

socket.on('measurement', (data) => {
    const measurementName = garmentMeasurements[selectedGarment][currentMeasurementIndex];
    updateMeasurement(measurementName, data.measurement);
    updateStatusMessage(`Recorded ${measurementName}. Say 'next' to continue or 'previous' to go back.`);
});

socket.on('next', () => {
    moveToNextMeasurement();
});

socket.on('previous', () => {
    moveToPreviousMeasurement();
});

function moveToNextMeasurement() {
    const measurements = garmentMeasurements[selectedGarment];
    if (currentMeasurementIndex < measurements.length - 1) {
        currentMeasurementIndex += 1;
        highlightCurrentMeasurement();
        updateStatusMessage("Moved to the next measurement.");
    } else {
        updateStatusMessage("All measurements completed. Please stop the recording.");
    }
}

function moveToPreviousMeasurement() {
    if (currentMeasurementIndex > 0) {
        currentMeasurementIndex -= 1;
        highlightCurrentMeasurement();
        updateStatusMessage("Moved to the previous measurement.");
    } else {
        updateStatusMessage("You are at the first measurement.");
    }
}

function updateMeasurement(measurementName, measurementValue) {
    const listItem = document.querySelector(`#measurement-list li#measurement-${garmentMeasurements[selectedGarment].indexOf(measurementName)} span`);
    if (listItem) {
        listItem.innerText = measurementValue;
        measurementsRecorded[measurementName] = measurementValue;
    }
}

function updateTable() {
    const outputBody = document.getElementById("output-table").getElementsByTagName('tbody')[0];
    outputBody.innerHTML = "";

    Object.entries(measurementsRecorded).forEach(([measurement, value]) => {
        const row = document.createElement('tr');

        const measurementCell = document.createElement('td');
        measurementCell.innerText = measurement;
        measurementCell.setAttribute('contenteditable', true);
        measurementCell.addEventListener('blur', () => updateMeasurementOnEdit(measurementCell, 'measurement'));
        measurementCell.addEventListener('keydown', (e) => handleKeyDown(e, measurementCell, 'measurement'));

        const valueCell = document.createElement('td');
        valueCell.innerText = value;
        valueCell.setAttribute('contenteditable', true);
        valueCell.addEventListener('blur', () => updateMeasurementOnEdit(valueCell, 'value'));
        valueCell.addEventListener('keydown', (e) => handleKeyDown(e, valueCell, 'value'));

        row.appendChild(measurementCell);
        row.appendChild(valueCell);
        outputBody.appendChild(row);
    });
}

function updateMeasurementOnEdit(cell, type) {
    const updatedValue = cell.innerText.trim();

    if (type === 'measurement') {
        const oldMeasurement = Object.keys(measurementsRecorded).find(measurement => measurementsRecorded[measurement] === cell.innerText);
        if (updatedValue && updatedValue !== oldMeasurement) {
            const value = measurementsRecorded[oldMeasurement];
            delete measurementsRecorded[oldMeasurement];
            measurementsRecorded[updatedValue] = value;
        }
    } else if (type === 'value') {
        const measurement = Object.keys(measurementsRecorded).find(measurement => measurementsRecorded[measurement] === cell.innerText);
        measurementsRecorded[measurement] = updatedValue;
    }
}

function handleKeyDown(event, cell, type) {
    if (event.key === 'Enter') {
        event.preventDefault();
        updateMeasurementOnEdit(cell, type);
        cell.blur();
    }

    if (type === 'measurement' && /[0-9]/.test(event.key) && event.key !== 'Backspace') {
        event.preventDefault();
    }

    if (type === 'value') {
        if (event.key === 'Backspace' || event.key === 'Delete' || /[0-9]/.test(event.key) || event.key === '.') {
            if (event.key === '.' && cell.innerText.indexOf('.') !== -1) {
                event.preventDefault();
            }
        } else {
            event.preventDefault();
        }
    }
}

function updateStatusMessage(message) {
    const messageElement = document.getElementById("status-message");
    messageElement.innerText = message;
    setTimeout(() => {
        messageElement.innerText = '';
    }, 2000);
}
