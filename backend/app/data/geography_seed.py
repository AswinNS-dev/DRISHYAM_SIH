"""Authoritative Indian States, Union Territories, Districts, and Police Stations.

Provides canonical geographical hierarchy for all 28 States and 8 Union Territories
of India with real districts and geographically situated police stations with valid
latitude and longitude coordinates.
"""
from __future__ import annotations

# All 28 States and 8 Union Territories
INDIAN_STATES: list[dict[str, str]] = [
    {"code": "AN", "name": "Andaman and Nicobar Islands", "type": "union_territory"},
    {"code": "AP", "name": "Andhra Pradesh", "type": "state"},
    {"code": "AR", "name": "Arunachal Pradesh", "type": "state"},
    {"code": "AS", "name": "Assam", "type": "state"},
    {"code": "BR", "name": "Bihar", "type": "state"},
    {"code": "CH", "name": "Chandigarh", "type": "union_territory"},
    {"code": "CG", "name": "Chhattisgarh", "type": "state"},
    {"code": "DN", "name": "Dadra and Nagar Haveli and Daman and Diu", "type": "union_territory"},
    {"code": "DL", "name": "Delhi", "type": "union_territory"},
    {"code": "GA", "name": "Goa", "type": "state"},
    {"code": "GJ", "name": "Gujarat", "type": "state"},
    {"code": "HR", "name": "Haryana", "type": "state"},
    {"code": "HP", "name": "Himachal Pradesh", "type": "state"},
    {"code": "JK", "name": "Jammu and Kashmir", "type": "union_territory"},
    {"code": "JH", "name": "Jharkhand", "type": "state"},
    {"code": "KA", "name": "Karnataka", "type": "state"},
    {"code": "KL", "name": "Kerala", "type": "state"},
    {"code": "LA", "name": "Ladakh", "type": "union_territory"},
    {"code": "LD", "name": "Lakshadweep", "type": "union_territory"},
    {"code": "MP", "name": "Madhya Pradesh", "type": "state"},
    {"code": "MH", "name": "Maharashtra", "type": "state"},
    {"code": "MN", "name": "Manipur", "type": "state"},
    {"code": "ML", "name": "Meghalaya", "type": "state"},
    {"code": "MZ", "name": "Mizoram", "type": "state"},
    {"code": "NL", "name": "Nagaland", "type": "state"},
    {"code": "OD", "name": "Odisha", "type": "state"},
    {"code": "PY", "name": "Puducherry", "type": "union_territory"},
    {"code": "PB", "name": "Punjab", "type": "state"},
    {"code": "RJ", "name": "Rajasthan", "type": "state"},
    {"code": "SK", "name": "Sikkim", "type": "state"},
    {"code": "TN", "name": "Tamil Nadu", "type": "state"},
    {"code": "TS", "name": "Telangana", "type": "state"},
    {"code": "TR", "name": "Tripura", "type": "state"},
    {"code": "UP", "name": "Uttar Pradesh", "type": "state"},
    {"code": "UK", "name": "Uttarakhand", "type": "state"},
    {"code": "WB", "name": "West Bengal", "type": "state"},
]

# State Code -> List of Districts (with district code, name, and representative police stations with coordinates)
DISTRICTS_AND_STATIONS: dict[str, list[dict]] = {
    "KA": [
        {
            "code": "KA-BLU", "name": "Bengaluru Urban",
            "stations": [
                {"code": "KA-BLU-01", "name": "Whitefield Police Station", "lat": 12.9698, "lon": 77.7500},
                {"code": "KA-BLU-02", "name": "K.R. Puram Police Station", "lat": 13.0090, "lon": 77.6800},
                {"code": "KA-BLU-03", "name": "Indiranagar Police Station", "lat": 12.9784, "lon": 77.6408},
                {"code": "KA-BLU-04", "name": "Koramangala Police Station", "lat": 12.9352, "lon": 77.6245},
                {"code": "KA-BLU-05", "name": "Cubbon Park Police Station", "lat": 12.9760, "lon": 77.5929},
            ]
        },
        {
            "code": "KA-MYS", "name": "Mysuru",
            "stations": [
                {"code": "KA-MYS-01", "name": "Devaraja Police Station", "lat": 12.3052, "lon": 76.6552},
                {"code": "KA-MYS-02", "name": "Lashkar Police Station", "lat": 12.3160, "lon": 76.6570},
                {"code": "KA-MYS-03", "name": "V.V. Puram Police Station", "lat": 12.3325, "lon": 76.6340},
            ]
        },
        {
            "code": "KA-DKA", "name": "Dakshina Kannada",
            "stations": [
                {"code": "KA-DKA-01", "name": "Pandeshwar Police Station", "lat": 12.8610, "lon": 74.8430},
                {"code": "KA-DKA-02", "name": "Barke Police Station", "lat": 12.8820, "lon": 74.8380},
                {"code": "KA-DKA-03", "name": "Panambur Police Station", "lat": 12.9510, "lon": 74.8150},
            ]
        },
        {
            "code": "KA-BEL", "name": "Belagavi",
            "stations": [
                {"code": "KA-BEL-01", "name": "Market Police Station", "lat": 15.8520, "lon": 74.5050},
                {"code": "KA-BEL-02", "name": "Camp Police Station", "lat": 15.8640, "lon": 74.5120},
                {"code": "KA-BEL-03", "name": "Khade Bazar Police Station", "lat": 15.8490, "lon": 74.4980},
            ]
        },
        {
            "code": "KA-KAL", "name": "Kalaburagi",
            "stations": [
                {"code": "KA-KAL-01", "name": "Brahmapur Police Station", "lat": 17.3320, "lon": 76.8370},
                {"code": "KA-KAL-02", "name": "Chowk Police Station", "lat": 17.3290, "lon": 76.8290},
            ]
        },
        {
            "code": "KA-DWD", "name": "Dharwad",
            "stations": [
                {"code": "KA-DWD-01", "name": "Suburban Police Station", "lat": 15.3647, "lon": 75.1240},
                {"code": "KA-DWD-02", "name": "Vidyanagar Police Station", "lat": 15.3520, "lon": 75.1380},
            ]
        },
        {
            "code": "KA-BAL", "name": "Ballari",
            "stations": [
                {"code": "KA-BAL-01", "name": "Brucepet Police Station", "lat": 15.1394, "lon": 76.9214},
                {"code": "KA-BAL-02", "name": "Cowlbazaar Police Station", "lat": 15.1480, "lon": 76.9350},
            ]
        },
        {
            "code": "KA-HAS", "name": "Hassan",
            "stations": [
                {"code": "KA-HAS-01", "name": "Hassan City Police Station", "lat": 13.0070, "lon": 76.0960},
                {"code": "KA-HAS-02", "name": "Pension Mohalla Police Station", "lat": 13.0120, "lon": 76.1040},
            ]
        },
        {
            "code": "KA-TUM", "name": "Tumakuru",
            "stations": [
                {"code": "KA-TUM-01", "name": "Tumakuru Town Police Station", "lat": 13.3409, "lon": 77.1010},
                {"code": "KA-TUM-02", "name": "New Extension Police Station", "lat": 13.3480, "lon": 77.1120},
            ]
        },
        {
            "code": "KA-SHI", "name": "Shivamogga",
            "stations": [
                {"code": "KA-SHI-01", "name": "Kote Police Station", "lat": 13.9299, "lon": 75.5681},
                {"code": "KA-SHI-02", "name": "Vinobanagar Police Station", "lat": 13.9420, "lon": 75.5800},
            ]
        },
        {
            "code": "KA-UDU", "name": "Udupi",
            "stations": [
                {"code": "KA-UDU-01", "name": "Udupi Town Police Station", "lat": 13.3409, "lon": 74.7421},
                {"code": "KA-UDU-02", "name": "Malpe Police Station", "lat": 13.3560, "lon": 74.7040},
            ]
        },
        {
            "code": "KA-DAV", "name": "Davanagere",
            "stations": [
                {"code": "KA-DAV-01", "name": "KTJ Nagar Police Station", "lat": 14.4644, "lon": 75.9218},
                {"code": "KA-DAV-02", "name": "Gandhinagar Police Station", "lat": 14.4720, "lon": 75.9150},
            ]
        },
    ],
    "MH": [
        {
            "code": "MH-MUM", "name": "Mumbai City",
            "stations": [
                {"code": "MH-MUM-01", "name": "Colaba Police Station", "lat": 18.9154, "lon": 72.8258},
                {"code": "MH-MUM-02", "name": "Marine Drive Police Station", "lat": 18.9438, "lon": 72.8232},
                {"code": "MH-MUM-03", "name": "Bandra Police Station", "lat": 19.0544, "lon": 72.8402},
                {"code": "MH-MUM-04", "name": "Andheri Police Station", "lat": 19.1197, "lon": 72.8464},
                {"code": "MH-MUM-05", "name": "Dharavi Police Station", "lat": 19.0402, "lon": 72.8508},
            ]
        },
        {
            "code": "MH-PUN", "name": "Pune",
            "stations": [
                {"code": "MH-PUN-01", "name": "Shivajinagar Police Station", "lat": 18.5314, "lon": 73.8446},
                {"code": "MH-PUN-02", "name": "Kothrud Police Station", "lat": 18.5074, "lon": 73.8077},
                {"code": "MH-PUN-03", "name": "Hinjawadi Police Station", "lat": 18.5913, "lon": 73.7389},
            ]
        },
        {
            "code": "MH-NAG", "name": "Nagpur",
            "stations": [
                {"code": "MH-NAG-01", "name": "Sitabuldi Police Station", "lat": 21.1458, "lon": 79.0882},
                {"code": "MH-NAG-02", "name": "Dhantoli Police Station", "lat": 21.1320, "lon": 79.0830},
            ]
        },
        {
            "code": "MH-THN", "name": "Thane",
            "stations": [
                {"code": "MH-THN-01", "name": "Naupada Police Station", "lat": 19.1860, "lon": 72.9750},
                {"code": "MH-THN-02", "name": "Wagle Estate Police Station", "lat": 19.1950, "lon": 72.9520},
            ]
        },
        {
            "code": "MH-NSK", "name": "Nashik",
            "stations": [
                {"code": "MH-NSK-01", "name": "Bhadrakali Police Station", "lat": 19.9975, "lon": 73.7898},
                {"code": "MH-NSK-02", "name": "Panchavati Police Station", "lat": 20.0120, "lon": 73.7950},
            ]
        },
        {
            "code": "MH-KOL", "name": "Kolhapur",
            "stations": [
                {"code": "MH-KOL-01", "name": "Juna Rajwada Police Station", "lat": 16.7050, "lon": 74.2433},
                {"code": "MH-KOL-02", "name": "Shahupuri Police Station", "lat": 16.7010, "lon": 74.2370},
            ]
        },
    ],
    "TN": [
        {
            "code": "TN-CHE", "name": "Chennai",
            "stations": [
                {"code": "TN-CHE-01", "name": "Mylapore Police Station", "lat": 13.0368, "lon": 80.2676},
                {"code": "TN-CHE-02", "name": "T. Nagar Police Station", "lat": 13.0418, "lon": 80.2341},
                {"code": "TN-CHE-03", "name": "Anna Nagar Police Station", "lat": 13.0850, "lon": 80.2100},
                {"code": "TN-CHE-04", "name": "Flower Bazaar Police Station", "lat": 13.0900, "lon": 80.2850},
            ]
        },
        {
            "code": "TN-CBE", "name": "Coimbatore",
            "stations": [
                {"code": "TN-CBE-01", "name": "R.S. Puram Police Station", "lat": 11.0118, "lon": 76.9460},
                {"code": "TN-CBE-02", "name": "Gandhipuram Police Station", "lat": 11.0180, "lon": 76.9680},
                {"code": "TN-CBE-03", "name": "Singanallur Police Station", "lat": 10.9990, "lon": 77.0250},
            ]
        },
        {
            "code": "TN-MDU", "name": "Madurai",
            "stations": [
                {"code": "TN-MDU-01", "name": "Vilakkuthoon Police Station", "lat": 9.9195, "lon": 78.1198},
                {"code": "TN-MDU-02", "name": "Tallakulam Police Station", "lat": 9.9320, "lon": 78.1340},
            ]
        },
        {
            "code": "TN-KRI", "name": "Krishnagiri",
            "stations": [
                {"code": "TN-KRI-01", "name": "Hosur Town Police Station", "lat": 12.7409, "lon": 77.8253},
                {"code": "TN-KRI-02", "name": "SIPCOT Hosur Police Station", "lat": 12.7560, "lon": 77.8100},
            ]
        },
        {
            "code": "TN-SLM", "name": "Salem",
            "stations": [
                {"code": "TN-SLM-01", "name": "Town Police Station Salem", "lat": 11.6643, "lon": 78.1460},
                {"code": "TN-SLM-02", "name": "Hasthampatti Police Station", "lat": 11.6780, "lon": 78.1560},
            ]
        },
    ],
    "TS": [
        {
            "code": "TS-HYD", "name": "Hyderabad",
            "stations": [
                {"code": "TS-HYD-01", "name": "Banjara Hills Police Station", "lat": 17.4156, "lon": 78.4350},
                {"code": "TS-HYD-02", "name": "Jubilee Hills Police Station", "lat": 17.4319, "lon": 78.4073},
                {"code": "TS-HYD-03", "name": "Charminar Police Station", "lat": 17.3616, "lon": 78.4747},
                {"code": "TS-HYD-04", "name": "Cyberabad Police Station", "lat": 17.4399, "lon": 78.3758},
            ]
        },
        {
            "code": "TS-RNG", "name": "Ranga Reddy",
            "stations": [
                {"code": "TS-RNG-01", "name": "Gachibowli Police Station", "lat": 17.4401, "lon": 78.3489},
                {"code": "TS-RNG-02", "name": "Shamshabad Police Station", "lat": 17.2520, "lon": 78.3970},
            ]
        },
        {
            "code": "TS-WGL", "name": "Warangal",
            "stations": [
                {"code": "TS-WGL-01", "name": "Subedari Police Station", "lat": 17.9689, "lon": 79.5941},
                {"code": "TS-WGL-02", "name": "Mills Colony Police Station", "lat": 17.9750, "lon": 79.6050},
            ]
        },
    ],
    "AP": [
        {
            "code": "AP-VIS", "name": "Visakhapatnam",
            "stations": [
                {"code": "AP-VIS-01", "name": "MVP Colony Police Station", "lat": 17.7412, "lon": 83.3326},
                {"code": "AP-VIS-02", "name": "II Town Police Station Vizag", "lat": 17.7120, "lon": 83.2980},
                {"code": "AP-VIS-03", "name": "Gajuwaka Police Station", "lat": 17.6910, "lon": 83.2150},
            ]
        },
        {
            "code": "AP-VIJ", "name": "NTR Vijayawada",
            "stations": [
                {"code": "AP-VIJ-01", "name": "Governorpet Police Station", "lat": 16.5062, "lon": 80.6480},
                {"code": "AP-VIJ-02", "name": "Suryaraopet Police Station", "lat": 16.5140, "lon": 80.6320},
            ]
        },
        {
            "code": "AP-CTR", "name": "Chittoor",
            "stations": [
                {"code": "AP-CTR-01", "name": "Tirupati East Police Station", "lat": 13.6288, "lon": 79.4192},
                {"code": "AP-CTR-02", "name": "Tirupati West Police Station", "lat": 13.6350, "lon": 79.4080},
            ]
        },
    ],
    "DL": [
        {
            "code": "DL-NEW", "name": "New Delhi",
            "stations": [
                {"code": "DL-NEW-01", "name": "Parliament Street Police Station", "lat": 28.6253, "lon": 77.2140},
                {"code": "DL-NEW-02", "name": "Connaught Place Police Station", "lat": 28.6320, "lon": 77.2190},
                {"code": "DL-NEW-03", "name": "Chanakyapuri Police Station", "lat": 28.5980, "lon": 77.1890},
            ]
        },
        {
            "code": "DL-SOU", "name": "South Delhi",
            "stations": [
                {"code": "DL-SOU-01", "name": "Hauz Khas Police Station", "lat": 28.5494, "lon": 77.2001},
                {"code": "DL-SOU-02", "name": "Saket Police Station", "lat": 28.5244, "lon": 77.2185},
            ]
        },
        {
            "code": "DL-CEN", "name": "Central Delhi",
            "stations": [
                {"code": "DL-CEN-01", "name": "Daryaganj Police Station", "lat": 28.6469, "lon": 77.2410},
                {"code": "DL-CEN-02", "name": "Karol Bagh Police Station", "lat": 28.6510, "lon": 77.1900},
            ]
        },
        {
            "code": "DL-EAS", "name": "East Delhi",
            "stations": [
                {"code": "DL-EAS-01", "name": "Preet Vihar Police Station", "lat": 28.6410, "lon": 77.2950},
                {"code": "DL-EAS-02", "name": "Mayur Vihar Police Station", "lat": 28.6080, "lon": 77.3020},
            ]
        },
    ],
    "GJ": [
        {
            "code": "GJ-AHM", "name": "Ahmedabad",
            "stations": [
                {"code": "GJ-AHM-01", "name": "Navrangpura Police Station", "lat": 23.0365, "lon": 72.5611},
                {"code": "GJ-AHM-02", "name": "Vastrapur Police Station", "lat": 23.0350, "lon": 72.5280},
                {"code": "GJ-AHM-03", "name": "Ellisbridge Police Station", "lat": 23.0230, "lon": 72.5710},
            ]
        },
        {
            "code": "GJ-SUR", "name": "Surat",
            "stations": [
                {"code": "GJ-SUR-01", "name": "Umra Police Station", "lat": 21.1702, "lon": 72.8311},
                {"code": "GJ-SUR-02", "name": "Varachha Police Station", "lat": 21.2150, "lon": 72.8550},
            ]
        },
        {
            "code": "GJ-VAD", "name": "Vadodara",
            "stations": [
                {"code": "GJ-VAD-01", "name": "Sayajigunj Police Station", "lat": 22.3072, "lon": 73.1812},
                {"code": "GJ-VAD-02", "name": "Raopura Police Station", "lat": 22.3020, "lon": 73.2010},
            ]
        },
    ],
    "KL": [
        {
            "code": "KL-EKM", "name": "Ernakulam",
            "stations": [
                {"code": "KL-EKM-01", "name": "Ernakulam Central Police Station", "lat": 9.9816, "lon": 76.2999},
                {"code": "KL-EKM-02", "name": "Fort Kochi Police Station", "lat": 9.9650, "lon": 76.2420},
                {"code": "KL-EKM-03", "name": "Kakkanad Police Station", "lat": 10.0150, "lon": 76.3420},
            ]
        },
        {
            "code": "KL-TVM", "name": "Thiruvananthapuram",
            "stations": [
                {"code": "KL-TVM-01", "name": "Cantonment Police Station", "lat": 8.5020, "lon": 76.9530},
                {"code": "KL-TVM-02", "name": "Museum Police Station", "lat": 8.5110, "lon": 76.9560},
            ]
        },
        {
            "code": "KL-KKD", "name": "Kozhikode",
            "stations": [
                {"code": "KL-KKD-01", "name": "Kasaba Police Station", "lat": 11.2588, "lon": 75.7804},
                {"code": "KL-KKD-02", "name": "Nadakkavu Police Station", "lat": 11.2720, "lon": 75.7790},
            ]
        },
    ],
    "WB": [
        {
            "code": "WB-KOL", "name": "Kolkata",
            "stations": [
                {"code": "WB-KOL-01", "name": "Park Street Police Station", "lat": 22.5510, "lon": 88.3530},
                {"code": "WB-KOL-02", "name": "Bhowanipore Police Station", "lat": 22.5320, "lon": 88.3480},
                {"code": "WB-KOL-03", "name": "Salt Lake Police Station", "lat": 22.5867, "lon": 88.4178},
            ]
        },
        {
            "code": "WB-DAR", "name": "Darjeeling",
            "stations": [
                {"code": "WB-DAR-01", "name": "Sadar Police Station Darjeeling", "lat": 27.0410, "lon": 88.2663},
                {"code": "WB-DAR-02", "name": "Siliguri Police Station", "lat": 26.7271, "lon": 88.4230},
            ]
        },
    ],
    "UP": [
        {
            "code": "UP-LKO", "name": "Lucknow",
            "stations": [
                {"code": "UP-LKO-01", "name": "Hazratganj Police Station", "lat": 26.8467, "lon": 80.9462},
                {"code": "UP-LKO-02", "name": "Gomti Nagar Police Station", "lat": 26.8520, "lon": 80.9980},
            ]
        },
        {
            "code": "UP-NOI", "name": "Gautam Buddha Nagar",
            "stations": [
                {"code": "UP-NOI-01", "name": "Sector 20 Noida Police Station", "lat": 28.5800, "lon": 77.3200},
                {"code": "UP-NOI-02", "name": "Sector 58 Noida Police Station", "lat": 28.6050, "lon": 77.3620},
            ]
        },
        {
            "code": "UP-VAR", "name": "Varanasi",
            "stations": [
                {"code": "UP-VAR-01", "name": "Dashashwamedh Police Station", "lat": 25.3109, "lon": 83.0104},
                {"code": "UP-VAR-02", "name": "Cantonment Police Station Varanasi", "lat": 25.3350, "lon": 82.9850},
            ]
        },
    ],
    "RJ": [
        {
            "code": "RJ-JAI", "name": "Jaipur",
            "stations": [
                {"code": "RJ-JAI-01", "name": "Manak Chowk Police Station", "lat": 26.9239, "lon": 75.8267},
                {"code": "RJ-JAI-02", "name": "Vaishali Nagar Police Station", "lat": 26.9080, "lon": 75.7480},
            ]
        },
        {
            "code": "RJ-JOD", "name": "Jodhpur",
            "stations": [
                {"code": "RJ-JOD-01", "name": "Sadar Kotwali Police Station", "lat": 26.2918, "lon": 73.0168},
                {"code": "RJ-JOD-02", "name": "Shastri Nagar Police Station", "lat": 26.2750, "lon": 73.0020},
            ]
        },
    ],
    "PB": [
        {
            "code": "PB-LUD", "name": "Ludhiana",
            "stations": [
                {"code": "PB-LUD-01", "name": "Division No 5 Police Station", "lat": 30.9010, "lon": 75.8573},
                {"code": "PB-LUD-02", "name": "Model Town Police Station", "lat": 30.8870, "lon": 75.8450},
            ]
        },
        {
            "code": "PB-ASR", "name": "Amritsar",
            "stations": [
                {"code": "PB-ASR-01", "name": "Civil Lines Police Station Amritsar", "lat": 31.6340, "lon": 74.8723},
                {"code": "PB-ASR-02", "name": "Kotwali Police Station Amritsar", "lat": 31.6210, "lon": 74.8810},
            ]
        },
    ],
    "HR": [
        {
            "code": "HR-GUR", "name": "Gurugram",
            "stations": [
                {"code": "HR-GUR-01", "name": "DLF Phase 2 Police Station", "lat": 28.4860, "lon": 77.0860},
                {"code": "HR-GUR-02", "name": "Cyber Crime Police Station Gurugram", "lat": 28.4720, "lon": 77.0720},
            ]
        },
        {
            "code": "HR-FAR", "name": "Faridabad",
            "stations": [
                {"code": "HR-FAR-01", "name": "Central Police Station Faridabad", "lat": 28.4089, "lon": 77.3178},
            ]
        },
    ],
    "MP": [
        {
            "code": "MP-BHO", "name": "Bhopal",
            "stations": [
                {"code": "MP-BHO-01", "name": "MP Nagar Police Station", "lat": 23.2332, "lon": 77.4343},
                {"code": "MP-BHO-02", "name": "TT Nagar Police Station", "lat": 23.2210, "lon": 77.4080},
            ]
        },
        {
            "code": "MP-IND", "name": "Indore",
            "stations": [
                {"code": "MP-IND-01", "name": "Palasia Police Station", "lat": 22.7244, "lon": 75.8839},
                {"code": "MP-IND-02", "name": "Vijay Nagar Police Station", "lat": 22.7533, "lon": 75.8937},
            ]
        },
    ],
    "BR": [
        {
            "code": "BR-PAT", "name": "Patna",
            "stations": [
                {"code": "BR-PAT-01", "name": "Kotwali Police Station Patna", "lat": 25.6120, "lon": 85.1380},
                {"code": "BR-PAT-02", "name": "Kankarbagh Police Station", "lat": 25.5940, "lon": 85.1520},
            ]
        },
    ],
    "OD": [
        {
            "code": "OD-KHO", "name": "Khurda",
            "stations": [
                {"code": "OD-KHO-01", "name": "Saheed Nagar Police Station", "lat": 20.2920, "lon": 85.8450},
                {"code": "OD-KHO-02", "name": "Khandagiri Police Station", "lat": 20.2580, "lon": 85.7820},
            ]
        },
    ],
    "AS": [
        {
            "code": "AS-KAM", "name": "Kamrup Metropolitan",
            "stations": [
                {"code": "AS-KAM-01", "name": "Panbazar Police Station", "lat": 26.1860, "lon": 91.7480},
                {"code": "AS-KAM-02", "name": "Dispur Police Station", "lat": 26.1420, "lon": 91.7920},
            ]
        },
    ],
    "CG": [
        {
            "code": "CG-RAI", "name": "Raipur",
            "stations": [
                {"code": "CG-RAI-01", "name": "Civil Lines Police Station Raipur", "lat": 21.2420, "lon": 81.6520},
            ]
        },
    ],
    "JH": [
        {
            "code": "JH-RAN", "name": "Ranchi",
            "stations": [
                {"code": "JH-RAN-01", "name": "Kotwali Police Station Ranchi", "lat": 23.3640, "lon": 85.3280},
            ]
        },
    ],
    "UK": [
        {
            "code": "UK-DEH", "name": "Dehradun",
            "stations": [
                {"code": "UK-DEH-01", "name": "Dalanwala Police Station", "lat": 30.3256, "lon": 78.0514},
            ]
        },
    ],
    "HP": [
        {
            "code": "HP-SHI", "name": "Shimla",
            "stations": [
                {"code": "HP-SHI-01", "name": "Sadar Police Station Shimla", "lat": 31.1048, "lon": 77.1734},
            ]
        },
    ],
    "GA": [
        {
            "code": "GA-NOR", "name": "North Goa",
            "stations": [
                {"code": "GA-NOR-01", "name": "Panaji Police Station", "lat": 15.4989, "lon": 73.8278},
                {"code": "GA-NOR-02", "name": "Calangute Police Station", "lat": 15.5440, "lon": 73.7550},
            ]
        },
        {
            "code": "GA-SOU", "name": "South Goa",
            "stations": [
                {"code": "GA-SOU-01", "name": "Margao Police Station", "lat": 15.2832, "lon": 73.9862},
            ]
        },
    ],
    "JK": [
        {
            "code": "JK-SRI", "name": "Srinagar",
            "stations": [
                {"code": "JK-SRI-01", "name": "Kothi Bagh Police Station", "lat": 34.0754, "lon": 74.8194},
            ]
        },
        {
            "code": "JK-JAM", "name": "Jammu",
            "stations": [
                {"code": "JK-JAM-01", "name": "Gandhi Nagar Police Station", "lat": 32.7060, "lon": 74.8690},
            ]
        },
    ],
    "CH": [
        {
            "code": "CH-CHD", "name": "Chandigarh",
            "stations": [
                {"code": "CH-CHD-01", "name": "Sector 17 Police Station", "lat": 30.7410, "lon": 76.7850},
                {"code": "CH-CHD-02", "name": "Sector 34 Police Station", "lat": 30.7220, "lon": 76.7680},
            ]
        },
    ],
    "PY": [
        {
            "code": "PY-PUD", "name": "Puducherry",
            "stations": [
                {"code": "PY-PUD-01", "name": "Grand Bazaar Police Station", "lat": 11.9340, "lon": 79.8310},
            ]
        },
    ],
    "AN": [
        {
            "code": "AN-SOU", "name": "South Andaman",
            "stations": [
                {"code": "AN-SOU-01", "name": "Aberdeen Police Station", "lat": 11.6680, "lon": 92.7410},
            ]
        },
    ],
    "DN": [
        {
            "code": "DN-DAM", "name": "Daman",
            "stations": [
                {"code": "DN-DAM-01", "name": "Nani Daman Police Station", "lat": 20.4170, "lon": 72.8330},
            ]
        },
    ],
    "LA": [
        {
            "code": "LA-LEH", "name": "Leh",
            "stations": [
                {"code": "LA-LEH-01", "name": "Leh Police Station", "lat": 34.1526, "lon": 77.5771},
            ]
        },
    ],
    "LD": [
        {
            "code": "LD-LAK", "name": "Lakshadweep",
            "stations": [
                {"code": "LD-LAK-01", "name": "Kavaratti Police Station", "lat": 10.5667, "lon": 72.6369},
            ]
        },
    ],
    "SK": [
        {
            "code": "SK-EAS", "name": "East Sikkim",
            "stations": [
                {"code": "SK-EAS-01", "name": "Sadar Police Station Gangtok", "lat": 27.3314, "lon": 88.6138},
            ]
        },
    ],
    "TR": [
        {
            "code": "TR-WES", "name": "West Tripura",
            "stations": [
                {"code": "TR-WES-01", "name": "West Agartala Police Station", "lat": 23.8315, "lon": 91.2868},
            ]
        },
    ],
    "ML": [
        {
            "code": "ML-EAS", "name": "East Khasi Hills",
            "stations": [
                {"code": "ML-EAS-01", "name": "Sadar Police Station Shillong", "lat": 25.5788, "lon": 91.8933},
            ]
        },
    ],
    "MN": [
        {
            "code": "MN-WES", "name": "Imphal West",
            "stations": [
                {"code": "MN-WES-01", "name": "Imphal Police Station", "lat": 24.8170, "lon": 93.9368},
            ]
        },
    ],
    "NL": [
        {
            "code": "NL-KOH", "name": "Kohima",
            "stations": [
                {"code": "NL-KOH-01", "name": "North Police Station Kohima", "lat": 25.6751, "lon": 94.1086},
            ]
        },
    ],
    "MZ": [
        {
            "code": "MZ-AIZ", "name": "Aizawl",
            "stations": [
                {"code": "MZ-AIZ-01", "name": "Aizawl Police Station", "lat": 23.7271, "lon": 92.7176},
            ]
        },
    ],
    "AR": [
        {
            "code": "AR-PAP", "name": "Papum Pare",
            "stations": [
                {"code": "AR-PAP-01", "name": "Itanagar Police Station", "lat": 27.0844, "lon": 93.6053},
            ]
        },
    ],
}
