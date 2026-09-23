import { listCarPhotos, photosForSave, MAX_CAR_PHOTOS } from "@/domain/cars/carPhotos";

describe("car photo gallery", () => {
  it("falls back to the cover when photos is empty", () => {
    expect(listCarPhotos({ photoUrl: "cars/a" })).toEqual(["cars/a"]);
  });

  it("uses photos as the gallery and keeps the cover first if missing", () => {
    expect(
      listCarPhotos({ photoUrl: "cars/cover", photos: ["cars/b", "cars/c"] })
    ).toEqual(["cars/cover", "cars/b", "cars/c"]);
  });

  it("dedupes and caps at MAX_CAR_PHOTOS", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `cars/${i}`);
    expect(listCarPhotos({ photos: [...ids, "cars/0"] })).toHaveLength(
      MAX_CAR_PHOTOS
    );
  });

  it("syncs photoUrl to the first gallery image on save", () => {
    expect(photosForSave(["cars/a", "cars/b"])).toEqual({
      photos: ["cars/a", "cars/b"],
      photoUrl: "cars/a",
    });
  });
});
