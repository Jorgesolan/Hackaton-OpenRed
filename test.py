import requests

url = "http://127.0.0.1:8000/api/measurements/"  # API de prueba
response = requests.get(url)  # Hacer la petición GET

if response.status_code == 200:  # Verificar que la petición fue exitosa
    data = response.json()  # Convertir la respuesta a JSON
    print(data)  # Mostrar el resultado
else:
    print("Error en la solicitud:", response.status_code)
