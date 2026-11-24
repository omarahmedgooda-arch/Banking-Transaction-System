FROM eclipse-temurin:21-jre
RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app
ADD --chown=user https://raw.githubusercontent.com/omarahmedgooda-arch/Banking-Transaction-System/main/release/ershak.jar ershak.jar
ENV PORT=7860 \
    ERSHAK_DB=jdbc:sqlite:/tmp/ershak.db \
    ERSHAK_DEMO_DATA=true
EXPOSE 7860
ENTRYPOINT ["java", "-jar", "ershak.jar"]
