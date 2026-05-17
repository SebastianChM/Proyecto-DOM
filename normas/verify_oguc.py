import re

with open('normas/oguc_text.txt', encoding='utf-8') as f:
    text = f.read()

def find_art(label, searches, chars=800):
    for search in searches:
        idx = text.find(search)
        if idx >= 0:
            print(f'\n=== {label} (found: "{search}") ===')
            print(text[idx:idx+chars])
            return
    print(f'\n=== {label} === NO ENCONTRADO (busque: {searches})')

# R003 - Art 4.1.1 altura habitable (2.30m)
find_art('R003 - Art 4.1.1 altura habitable', ['4.1.1.'])

# R010 - Art 4.1.2 ventana
find_art('R010 - Art 4.1.2 ventana', ['4.1.2.'])

# R006 - Art 4.1.7 rampas (8%)
# find the real definition at pos 543391
print('\n=== R006 - Art 4.1.7 rampas (desde pos 543391) ===')
chunk = text[543391:543391+3000]
p8 = chunk.find('8%')
if p8 >= 0:
    print(chunk[max(0, p8-300):p8+700])
else:
    # search for pendiente
    pp = chunk.find('endiente')
    print(f'pendiente at {pp}')
    print(chunk[max(0,pp-100):pp+500] if pp >= 0 else chunk[:1000])

# R009 - Art 4.2.7 barandas (0.95m)
print('\n=== R009 - Art 4.2.7 barandas ===')
idx = 0
found = False
while True:
    idx = text.find('4.2.7.', idx)
    if idx == -1:
        break
    snippet = text[idx:idx+600]
    if any(w in snippet.lower() for w in ['baranda', 'antepecho', 'abertura', 'balcon', 'terraza', 'caida']):
        print(f'pos {idx}:')
        print(snippet)
        found = True
        break
    idx += 6
if not found:
    # Search by content
    idx = text.find('0,95 m')
    while idx >= 0:
        snippet = text[max(0,idx-200):idx+400]
        if 'baranda' in snippet.lower() and 'antepecho' in snippet.lower():
            print(f'Baranda 0.95m en pos {idx}:')
            print(snippet)
            break
        idx = text.find('0,95 m', idx+1)

# R001 - Art 4.2.10 tabla ancho escaleras
print('\n=== R001 - Art 4.2.10 tabla escaleras ===')
# Search for the table content
for search in ['51 hasta 100', 'hasta 100', '1,20 m']:
    idx = text.find(search)
    while idx >= 0:
        snippet = text[max(0,idx-300):idx+600]
        if ('escalera' in snippet.lower() or 'personas' in snippet.lower()) and '1,20' in snippet:
            print(f'Found at pos {idx}:')
            print(snippet)
            break
        idx = text.find(search, idx+1)
    else:
        continue
    break

# R007/R008 - Art 4.2.11 contrahuella/huella
find_art('R007/R008 - Art 4.2.11 peldanos', ['4.2.11.'])

# R002 - Art 4.2.24 puertas escape
find_art('R002 - Art 4.2.24 puertas escape', ['4.2.24.'])

# FIRE articles - Art 4.3.3 table
print('\n=== FUEGO - Art 4.3.3 tabla resistencia ===')
idx = text.find('F-180')
if idx >= 0:
    print(text[max(0,idx-500):idx+2000])

# STRUCTURAL - Art 5.6.2 albanileria
find_art('R016 - Art 5.6.2 albanileria', ['5.6.2.'])

# STRUCTURAL - Art 5.7.5 fundaciones
find_art('R017 - Art 5.7.5 fundaciones', ['5.7.5.'])

print('\n=== FIN VERIFICACION ===')
