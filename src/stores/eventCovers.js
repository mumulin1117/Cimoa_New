// Versioned, event-specific media mapping. Only exact legacy catalogue paths
// are upgraded; custom covers, missing-image states and all attendance survive.
const covers = [
  ['picnic', 'event-picnic.png'], ['sketch', 'ev-camp.jpg'], ['badminton', 'ev-bike.jpg'],
  ['mic', 'ev-forest.jpg'], ['yoga', 'ev-boat.jpg'], ['language', 'ev-hike.png'],
  ['games', 'ev-camp.jpg'], ['hike', 'ev-hike.png'], ['film', 'event-picnic.png'],
  ['dumpling', 'ev-forest.jpg'], ['photowalk', 'ev-bike.jpg'], ['karaoke', 'ev-hike.png'],
  ['startup', 'ev-forest.jpg'], ['football', 'ev-boat.jpg'], ['market', 'event-picnic.png'],
  ['study', 'ev-camp.jpg'], ['run', 'ev-camp.jpg'], ['food-fair', 'ev-forest.jpg'],
  ['robotics', 'ev-boat.jpg'], ['jazz', 'ev-hike.png'], ['volunteer', 'ev-forest.jpg'],
  ['chess', 'ev-boat.jpg'],
]
export const EVENT_COVERS = Object.freeze(Object.fromEntries(covers.map(([key, legacy]) => [
  `event_${key}`, Object.freeze({ image_url: `/static/assets/events/${key}.jpg`, legacy_url: `/static/assets/img/${legacy}` }),
])))

export function upgrade_event_covers(data) {
  for (const event of data.events || []) {
    const cover = EVENT_COVERS[event.event_id]
    if (cover && event.image_url === cover.legacy_url) event.image_url = cover.image_url
  }
}
