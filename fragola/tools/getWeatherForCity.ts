import z from "zod";
import { Fragola, tool } from "../fragola";
import type { weatherStore } from "../../main";

const getWeatherForCity = tool({
    name: "getWeatherForCity",
    description: "Get current weather information for a specified city",
    schema: z.object({
        city: z.string(),
    }),
    handler: async (parameters, getStore) => {
        const { city } = parameters;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env["OPENWEATHER_API_KEY"]}&units=metric`;
        const store = getStore<typeof weatherStore>();

        if (store) {
            console.log(store.value);
        }
    
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return "ERROR";
            }
            
            const data = await response.json();
            return JSON.stringify({
                city: data.name,
                temperature: data.main.temp,
                description: data.weather[0].description,
                humidity: data.main.humidity,
                windSpeed: data.wind.speed
            });
        } catch (error) {
            return `ERROR: ${error}`;
        }
    }
});

export default getWeatherForCity;